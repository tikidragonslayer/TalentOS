/**
 * Stripe Webhook Handler — TalentSync (Matchmaker + Commitment Model)
 *
 * Handles TWO flows:
 * 1. Platform Fee payments (one-time) — employer pays 10% of bonus to activate a job
 * 2. Subscription payments (recurring) — existing starter/pro/enterprise plans
 *
 * SETUP:
 * 1. Set environment variables:
 *    - STRIPE_SECRET_KEY
 *    - STRIPE_WEBHOOK_SECRET
 * 2. Create webhook endpoint in Stripe Dashboard:
 *    URL: https://example.com/api/webhooks/stripe
 *    Events: checkout.session.completed, payment_intent.succeeded,
 *            payment_intent.payment_failed,
 *            customer.subscription.created, customer.subscription.updated,
 *            customer.subscription.deleted,
 *            invoice.payment_succeeded, invoice.payment_failed
 */

import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { db } from '@/lib/firebase-admin';
import { _matchCandidatesToJobInternal } from '@/app/actions/match-actions';
import { CREDITS_PER_TIER } from '@/config/stripe-products';

export const dynamic = 'force-dynamic';

function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error('STRIPE_SECRET_KEY is not configured');
  }
  return new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: '2025-04-30.basil',
  });
}

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

// ── Tier mapping for subscription plans ──────────────────────────────────────
function getTierFromPriceId(priceId: string | null | undefined): string {
  if (!priceId) return 'starter';

  const priceMap: Record<string, string> = {
    [process.env.STRIPE_PRICE_TALENTOS_STARTER_MONTHLY || '']: 'starter',
    [process.env.STRIPE_PRICE_TALENTOS_PRO_MONTHLY || '']: 'pro',
    [process.env.STRIPE_PRICE_TALENTOS_ENTERPRISE_MONTHLY || '']: 'enterprise',
  };

  return priceMap[priceId] || 'starter';
}

// ── Idempotency ──────────────────────────────────────────────────────────────
async function isEventProcessed(eventId: string): Promise<boolean> {
  const doc = await db.collection('stripe_events').doc(eventId).get();
  return doc.exists;
}

async function markEventProcessed(event: Stripe.Event): Promise<void> {
  await db.collection('stripe_events').doc(event.id).set({
    type: event.type,
    livemode: event.livemode,
    created: new Date(event.created * 1000).toISOString(),
    processed: new Date().toISOString(),
    dataObjectId: (event.data.object as any).id || null,
  });
}

// ── Helper: find user by stripeCustomerId ────────────────────────────────────
async function findUserByCustomerId(customerId: string) {
  const snap = await db
    .collection('users')
    .where('stripeCustomerId', '==', customerId)
    .limit(1)
    .get();
  return snap.empty ? null : snap.docs[0];
}

// ── Credit grant helper ─────────────────────────────────────────────────────
/**
 * Grant OS Credits to a user based on their plan tier.
 * Called on subscription activation and each billing cycle renewal.
 * Credits are RESET to the tier amount (not accumulated).
 */
async function grantCreditsForTier(
  userRef: FirebaseFirestore.DocumentReference,
  tier: string,
  reason: string,
) {
  const credits = CREDITS_PER_TIER[tier] ?? CREDITS_PER_TIER['free'];
  // -1 means unlimited — store a large sentinel value (999999)
  const creditValue = credits === -1 ? 999999 : credits;

  await userRef.set(
    {
      osCredits: creditValue,
      creditsGrantedAt: new Date().toISOString(),
      creditsReason: reason,
    },
    { merge: true },
  );

  console.log(
    `[Stripe Webhook] Granted ${credits === -1 ? 'unlimited' : credits} OS Credits to ${userRef.id} (${tier}, ${reason})`,
  );
}

// ── Platform Fee handler ─────────────────────────────────────────────────────
async function handlePlatformFeeSuccess(paymentIntent: Stripe.PaymentIntent) {
  const meta = paymentIntent.metadata;
  if (meta.type !== 'platform_fee') return false; // Not a platform fee payment

  const { firebaseUserId, jobId, bonusAmount, jobTitle } = meta;

  if (!firebaseUserId || !jobId) {
    console.error('[Stripe Webhook] Platform fee missing firebaseUserId or jobId');
    return true; // Consumed the event, but couldn't process
  }

  // 1. Activate the job listing
  const jobRef = db.collection('jobListings').doc(jobId);
  const jobDoc = await jobRef.get();

  if (!jobDoc.exists) {
    console.error(`[Stripe Webhook] Job ${jobId} not found for platform fee`);
    return true;
  }

  await jobRef.update({
    status: 'open',
    platformFeePaid: true,
    platformFeePaymentIntentId: paymentIntent.id,
    platformFeePaidAt: new Date().toISOString(),
    activatedAt: new Date().toISOString(),
  });

  // 2. Record the platform fee payment
  await db.collection('platform_fee_payments').doc(paymentIntent.id).set({
    paymentIntentId: paymentIntent.id,
    firebaseUserId,
    jobId,
    jobTitle: jobTitle || null,
    bonusAmount: Number(bonusAmount) || 0,
    platformFeeCents: paymentIntent.amount,
    currency: paymentIntent.currency,
    status: 'succeeded',
    livemode: paymentIntent.livemode,
    createdAt: new Date().toISOString(),
  });

  console.log(
    `[Stripe Webhook] Platform fee $${(paymentIntent.amount / 100).toFixed(2)} collected. ` +
    `Job ${jobId} activated for user ${firebaseUserId}.`
  );

  // 3. Trigger AI matching — scan all candidates against the newly activated job
  // Fire-and-forget: don't block the webhook response on AI matching
  _matchCandidatesToJobInternal(jobId)
    .then((result) => {
      if (result.success) {
        console.log(
          `[Stripe Webhook] AI matching complete for job ${jobId}: ${result.count} matches found.`
        );
      } else {
        console.error(
          `[Stripe Webhook] AI matching failed for job ${jobId}: ${result.error}`
        );
      }
    })
    .catch((err) => {
      console.error(`[Stripe Webhook] AI matching threw for job ${jobId}:`, err);
    });

  return true;
}

// ── Webhook handler ──────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = req.headers.get('stripe-signature');

  if (!sig || !webhookSecret) {
    return NextResponse.json(
      { error: 'Missing stripe-signature header or webhook secret' },
      { status: 400 }
    );
  }

  // 1. Verify signature
  let event: Stripe.Event;
  const stripe = getStripe();
  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[Stripe Webhook] Signature verification failed:', message);
    return NextResponse.json(
      { error: 'Webhook signature verification failed' },
      { status: 400 }
    );
  }

  // 2. Idempotency check
  if (await isEventProcessed(event.id)) {
    console.log(`[Stripe Webhook] Skipping duplicate event ${event.id}`);
    return NextResponse.json({ received: true, duplicate: true });
  }

  // 3. Handle event
  try {
    switch (event.type) {
      // ── Platform Fee (one-time PaymentIntent) ──────────────────────────
      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        const handled = await handlePlatformFeeSuccess(paymentIntent);
        if (!handled) {
          console.log('[Stripe Webhook] payment_intent.succeeded was not a platform_fee type — ignoring');
        }
        break;
      }

      case 'payment_intent.payment_failed': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        const meta = paymentIntent.metadata;
        if (meta.type === 'platform_fee' && meta.jobId) {
          console.warn(
            `[Stripe Webhook] Platform fee payment failed for job ${meta.jobId}, ` +
            `user ${meta.firebaseUserId}`
          );
          // Record the failure
          await db.collection('platform_fee_payments').doc(paymentIntent.id).set({
            paymentIntentId: paymentIntent.id,
            firebaseUserId: meta.firebaseUserId || null,
            jobId: meta.jobId,
            bonusAmount: Number(meta.bonusAmount) || 0,
            platformFeeCents: paymentIntent.amount,
            currency: paymentIntent.currency,
            status: 'failed',
            failureMessage: paymentIntent.last_payment_error?.message || null,
            livemode: paymentIntent.livemode,
            createdAt: new Date().toISOString(),
          });
        }
        break;
      }

      // ── Subscription Checkout (legacy/plan-based) ─────────────────────
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const firebaseUID =
          session.metadata?.firebaseUID ||
          session.metadata?.firebaseUserId ||
          session.client_reference_id;
        if (!firebaseUID) {
          console.error('[Stripe Webhook] No firebaseUID in checkout metadata');
          break;
        }

        const stripeCustomerId = session.customer as string;
        const stripeSubscriptionId = session.subscription as string;
        const metadataPlan = session.metadata?.plan;

        let planTier = metadataPlan || 'pro';
        if (stripeSubscriptionId && !metadataPlan) {
          const subscription = await stripe.subscriptions.retrieve(stripeSubscriptionId);
          const priceId = subscription.items.data[0]?.price?.id;
          planTier = getTierFromPriceId(priceId);
        }

        const userRef = db.collection('users').doc(firebaseUID);
        await userRef.set(
          {
            isPremium: true,
            subscriptionStatus: 'active',
            plan: planTier,
            stripeCustomerId,
            stripeSubscriptionId: stripeSubscriptionId || null,
            updatedAt: new Date().toISOString(),
          },
          { merge: true }
        );

        // Grant OS Credits for the new subscription tier
        await grantCreditsForTier(userRef, planTier, 'checkout_completed');

        console.log(`[Stripe Webhook] User ${firebaseUID} activated -> ${planTier}`);
        break;
      }

      case 'customer.subscription.created': {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId =
          typeof subscription.customer === 'string'
            ? subscription.customer
            : subscription.customer.id;

        const userDoc = await findUserByCustomerId(customerId);
        if (!userDoc) {
          console.warn('[Stripe Webhook] No user found for customer', customerId);
          break;
        }

        const priceId = subscription.items.data[0]?.price?.id;
        const planTier = getTierFromPriceId(priceId);

        await userDoc.ref.set(
          {
            isPremium: true,
            subscriptionStatus: 'active',
            plan: planTier,
            stripeSubscriptionId: subscription.id,
            updatedAt: new Date().toISOString(),
          },
          { merge: true }
        );

        // Grant OS Credits for the new subscription tier
        await grantCreditsForTier(userDoc.ref, planTier, 'subscription_created');

        console.log(`[Stripe Webhook] Subscription created for user ${userDoc.id} -> ${planTier}`);
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId =
          typeof subscription.customer === 'string'
            ? subscription.customer
            : subscription.customer.id;

        const userDoc = await findUserByCustomerId(customerId);
        if (!userDoc) break;

        const priceId = subscription.items.data[0]?.price?.id;
        const isActive = ['active', 'trialing'].includes(subscription.status);

        const newTier = isActive ? getTierFromPriceId(priceId) : 'free';

        await userDoc.ref.set(
          {
            isPremium: isActive,
            subscriptionStatus: isActive ? 'active' : subscription.status,
            plan: newTier,
            stripeSubscriptionId: subscription.id,
            currentPeriodEnd: new Date(
              subscription.current_period_end * 1000
            ).toISOString(),
            updatedAt: new Date().toISOString(),
          },
          { merge: true }
        );

        // Re-grant credits if plan tier changed (upgrade/downgrade)
        if (isActive) {
          await grantCreditsForTier(userDoc.ref, newTier, 'subscription_updated');
        }

        console.log(
          `[Stripe Webhook] Subscription updated for user ${userDoc.id} -> ${subscription.status} (${newTier})`
        );
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId =
          typeof subscription.customer === 'string'
            ? subscription.customer
            : subscription.customer.id;

        const userDoc = await findUserByCustomerId(customerId);
        if (!userDoc) break;

        await userDoc.ref.set(
          {
            isPremium: false,
            subscriptionStatus: 'canceled',
            plan: 'free',
            updatedAt: new Date().toISOString(),
          },
          { merge: true }
        );

        // Downgrade credits to free tier
        await grantCreditsForTier(userDoc.ref, 'free', 'subscription_canceled');

        console.log(`[Stripe Webhook] Subscription canceled for user ${userDoc.id}`);
        break;
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer as string;

        const userDoc = await findUserByCustomerId(customerId);
        if (!userDoc) break;

        await userDoc.ref.collection('payments').doc(invoice.id).set({
          amount: invoice.amount_paid,
          currency: invoice.currency,
          status: invoice.status,
          created: new Date(invoice.created * 1000).toISOString(),
          periodStart: invoice.period_start
            ? new Date(invoice.period_start * 1000).toISOString()
            : null,
          periodEnd: invoice.period_end
            ? new Date(invoice.period_end * 1000).toISOString()
            : null,
          invoiceUrl: invoice.hosted_invoice_url || null,
        });

        if (invoice.subscription) {
          const subscriptionId =
            typeof invoice.subscription === 'string'
              ? invoice.subscription
              : invoice.subscription.id;
          const subscription = await stripe.subscriptions.retrieve(subscriptionId);
          const priceId = subscription.items.data[0]?.price?.id;
          const invoiceTier = getTierFromPriceId(priceId);

          await userDoc.ref.set(
            {
              isPremium: true,
              subscriptionStatus: 'active',
              plan: invoiceTier,
              stripeSubscriptionId: subscriptionId,
              currentPeriodEnd: new Date(
                subscription.current_period_end * 1000
              ).toISOString(),
              updatedAt: new Date().toISOString(),
            },
            { merge: true }
          );

          // Refresh OS Credits for the new billing cycle
          await grantCreditsForTier(userDoc.ref, invoiceTier, 'invoice_renewal');
        }

        console.log(`[Stripe Webhook] Payment succeeded for user ${userDoc.id}`);
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer as string;

        const userDoc = await findUserByCustomerId(customerId);
        if (!userDoc) break;

        await userDoc.ref.set(
          {
            subscriptionStatus: 'past_due',
            updatedAt: new Date().toISOString(),
          },
          { merge: true }
        );

        console.warn(`[Stripe Webhook] Payment failed for user ${userDoc.id}`);
        break;
      }

      default:
        console.log(`[Stripe Webhook] Unhandled event type: ${event.type}`);
    }

    // 4. Mark event as processed (idempotency)
    await markEventProcessed(event);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Stripe Webhook] Handler failed:', message);
    return NextResponse.json(
      { error: 'Webhook handler failed' },
      { status: 500 }
    );
  }

  return NextResponse.json({ received: true });
}
