/**
 * stripe-products.ts — Centralized product/price catalog for TalentSync.
 *
 * TWO revenue streams:
 * 1. Platform Fee (one-time) — 10% of sign-on bonus (min $5) when employer posts a job
 * 2. Subscriptions (recurring) — employer/candidate plan tiers
 *
 * IMPORTANT: The `stripePriceId` fields must be set to actual Stripe Price IDs
 * after creating products in the Stripe Dashboard. Until then, subscription checkout will fail.
 * Platform fees are calculated dynamically and do not require a Price ID.
 */

export type BillingMode = 'payment' | 'subscription';
export type BillingInterval = 'month' | 'year';
export type PlanTier = 'free' | 'pro' | 'business' | 'enterprise' | 'team' | 'premium';

export interface StripeProduct {
  key: string;
  name: string;
  description: string;
  priceInCents: number;
  mode: BillingMode;
  interval?: BillingInterval;
  annualPriceInCents?: number;
  stripePriceId: string;
  annualStripePriceId?: string;
  domain: string;
  appId: string;
  tier: PlanTier;
  recommended?: boolean;
  features: string[];
  trialDays?: number;
}

// ── Platform Fee Configuration ───────────────────────────────────────────────
export const PLATFORM_FEE_CONFIG = {
  /** Percentage of bonus amount charged as platform fee */
  rate: 0.10,
  /** Minimum platform fee in cents ($5.00) */
  minFeeCents: 500,
  /** Minimum bonus amount allowed in dollars */
  minBonusAmount: 50,
} as const;

/** Calculate the platform fee for a given bonus amount (in dollars). Returns cents. */
export function calculatePlatformFee(bonusAmountDollars: number): number {
  const feeCents = Math.round(bonusAmountDollars * PLATFORM_FEE_CONFIG.rate * 100);
  return Math.max(feeCents, PLATFORM_FEE_CONFIG.minFeeCents);
}

/** Format platform fee for display */
export function formatPlatformFee(bonusAmountDollars: number): string {
  const feeCents = calculatePlatformFee(bonusAmountDollars);
  return `$${(feeCents / 100).toFixed(2)}`;
}

// ── OS Credits per Plan Tier ─────────────────────────────────────────────────
// Credits are granted on subscription activation and refreshed each billing cycle.
// -1 means unlimited (enterprise).
export const CREDITS_PER_TIER: Record<string, number> = {
  free: 3,
  starter: 10,
  pro: 50,
  enterprise: -1, // unlimited
  team: 50,
  premium: 50,
} as const;

/** Get the monthly credit grant for a plan tier. Returns Infinity for unlimited. */
export function getCreditsForTier(tier: string): number {
  const credits = CREDITS_PER_TIER[tier] ?? 3;
  return credits === -1 ? Infinity : credits;
}

// ── Subscription Products ────────────────────────────────────────────────────
export const STRIPE_PRODUCTS: StripeProduct[] = [
  {
    key: 'talentos-free',
    name: 'TalentSync Free',
    description: 'Basic profile and job matching',
    priceInCents: 0,
    mode: 'subscription',
    stripePriceId: '',
    domain: process.env.NEXT_PUBLIC_BILLING_DOMAIN ?? 'example.com',
    appId: 'talentos',
    tier: 'free',
    features: [
      'Candidate profile',
      'Basic job matching',
      '5 applications/month',
      'Skill assessment (1 per month)',
    ],
  },
  {
    key: 'talentos-pro',
    name: 'TalentSync Pro',
    description: 'Advanced matching and unlimited applications',
    priceInCents: 1499,
    mode: 'subscription',
    interval: 'month',
    annualPriceInCents: 14990,
    stripePriceId: '',
    annualStripePriceId: '',
    domain: process.env.NEXT_PUBLIC_BILLING_DOMAIN ?? 'example.com',
    appId: 'talentos',
    tier: 'pro',
    recommended: true,
    trialDays: 7,
    features: [
      'Anonymous matching',
      'Unlimited applications',
      'Advanced skill assessments',
      'Salary insights',
      'Priority visibility',
    ],
  },
  {
    key: 'talentos-team',
    name: 'TalentSync Team',
    description: 'Employer tools with team analytics',
    priceInCents: 9900,
    mode: 'subscription',
    interval: 'month',
    annualPriceInCents: 99000,
    stripePriceId: '',
    annualStripePriceId: '',
    domain: process.env.NEXT_PUBLIC_BILLING_DOMAIN ?? 'example.com',
    appId: 'talentos',
    tier: 'team',
    features: [
      'Everything in Pro',
      'Employer dashboard',
      'Team analytics',
      'Candidate pipeline',
      'Custom assessments',
      'API access',
    ],
  },
];

export function getProductsByDomain(domain: string): StripeProduct[] {
  return STRIPE_PRODUCTS.filter(p => p.domain === domain);
}

export function getProductsByApp(appId: string): StripeProduct[] {
  return STRIPE_PRODUCTS.filter(p => p.appId === appId);
}

export function getProduct(key: string): StripeProduct | undefined {
  return STRIPE_PRODUCTS.find(p => p.key === key);
}

export function getSubscriptionProducts(appId: string): StripeProduct[] {
  return STRIPE_PRODUCTS.filter(p => p.appId === appId && (p.mode === 'subscription' || p.priceInCents === 0));
}

export function formatPrice(cents: number): string {
  if (cents === 0) return 'Free';
  return `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`;
}

export function formatPriceWithInterval(product: StripeProduct): string {
  if (product.priceInCents === 0) return 'Free';
  const price = formatPrice(product.priceInCents);
  if (product.mode === 'subscription' && product.interval) {
    return `${price}/${product.interval === 'month' ? 'mo' : 'yr'}`;
  }
  return price;
}
