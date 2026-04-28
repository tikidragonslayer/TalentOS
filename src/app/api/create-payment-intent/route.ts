// src/app/api/create-payment-intent/route.ts
//
// Platform Fee Checkout — Matchmaker + Commitment Model
// Employer pays 10% of bonus amount (min $5) as a one-time platform fee.
// No escrow, no Connect, no transfers. TalentSync keeps the fee.

import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { auth } from '@/lib/firebase-admin';

export const dynamic = 'force-dynamic';

// Rate limit: 5 payment intent creations per UID per 60s
const _uidCounts = new Map<string, { count: number; resetAt: number }>();
function checkRateLimit(uid: string): boolean {
  const now = Date.now();
  const rec = _uidCounts.get(uid);
  if (!rec || now > rec.resetAt) {
    _uidCounts.set(uid, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  if (rec.count >= 5) return false;
  rec.count++;
  return true;
}

function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error('STRIPE_SECRET_KEY is not configured');
  }
  return new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: '2025-04-30.basil',
  });
}

const MIN_PLATFORM_FEE_CENTS = 500; // $5.00 minimum
const PLATFORM_FEE_RATE = 0.10; // 10%

export async function POST(request: Request) {
  try {
    // 1. Verify Firebase Auth token
    const authHeader = request.headers.get('authorization');
    const idToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!idToken) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    let decodedToken;
    try {
      decodedToken = await auth.verifyIdToken(idToken);
    } catch {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    if (!checkRateLimit(decodedToken.uid)) {
      return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 });
    }

    const { bonusAmount, jobId, jobTitle } = await request.json();

    // 2. Validate bonus amount
    if (!bonusAmount || typeof bonusAmount !== 'number' || bonusAmount < 50) {
      return NextResponse.json(
        { error: 'Bonus amount must be at least $50' },
        { status: 400 }
      );
    }

    if (!jobId || typeof jobId !== 'string') {
      return NextResponse.json(
        { error: 'Job ID is required' },
        { status: 400 }
      );
    }

    // 3. Calculate platform fee: 10% of bonus, minimum $5
    const calculatedFeeCents = Math.round(bonusAmount * PLATFORM_FEE_RATE * 100);
    const platformFeeCents = Math.max(calculatedFeeCents, MIN_PLATFORM_FEE_CENTS);

    // 4. Create a simple PaymentIntent for the platform fee only
    const stripe = getStripe();
    const paymentIntent = await stripe.paymentIntents.create({
      amount: platformFeeCents,
      currency: 'usd',
      automatic_payment_methods: { enabled: true },
      metadata: {
        type: 'platform_fee',
        firebaseUserId: decodedToken.uid,
        jobId,
        jobTitle: jobTitle || 'Untitled Role',
        bonusAmount: String(bonusAmount),
        platformFeeRate: String(PLATFORM_FEE_RATE),
      },
      description: `TalentSync platform fee for "${jobTitle || 'Job Listing'}" — $${bonusAmount} sign-on bonus`,
    });

    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
      platformFeeCents,
      platformFeeFormatted: `$${(platformFeeCents / 100).toFixed(2)}`,
    });
  } catch (error) {
    console.error('[Platform Fee] Error creating payment intent:', error);
    return NextResponse.json({ error: 'Payment processing failed' }, { status: 500 });
  }
}
