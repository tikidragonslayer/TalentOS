import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { auth } from '@/lib/firebase-admin';

export const dynamic = 'force-dynamic';

function getStripe() {
    if (!process.env.STRIPE_SECRET_KEY) {
        throw new Error('STRIPE_SECRET_KEY is not configured');
    }
    return new Stripe(process.env.STRIPE_SECRET_KEY, {
        apiVersion: '2025-04-30.basil',
    });
}

// Map plan names to Stripe Price IDs from environment
const PLAN_PRICES: Record<string, string | undefined> = {
    starter: process.env.STRIPE_PRICE_TALENTOS_STARTER_MONTHLY,
    pro: process.env.STRIPE_PRICE_TALENTOS_PRO_MONTHLY,
    enterprise: process.env.STRIPE_PRICE_TALENTOS_ENTERPRISE_MONTHLY,
};

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

        const { plan } = await request.json();

        if (!plan || !PLAN_PRICES[plan]) {
            return NextResponse.json({ error: 'Invalid plan. Allowed: starter, pro, enterprise' }, { status: 400 });
        }

        const priceId = PLAN_PRICES[plan];
        if (!priceId) {
            return NextResponse.json({ error: `Price ID not configured for ${plan} plan` }, { status: 500 });
        }

        const stripe = getStripe();

        const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://example.com';

        // 2. Create Stripe Checkout Session for subscription
        const session = await stripe.checkout.sessions.create({
            mode: 'subscription',
            payment_method_types: ['card'],
            line_items: [{ price: priceId, quantity: 1 }],
            success_url: `${siteUrl}/dashboard?upgraded=true`,
            cancel_url: `${siteUrl}/dashboard?canceled=true`,
            client_reference_id: decodedToken.uid,
            metadata: {
                firebaseUserId: decodedToken.uid,
                plan,
            },
        });

        return NextResponse.json({ sessionId: session.id, url: session.url });
    } catch (error) {
        console.error('[Stripe Checkout] Error:', error);
        return NextResponse.json({ error: 'An unexpected error occurred. Please try again.' }, { status: 500 });
    }
}
