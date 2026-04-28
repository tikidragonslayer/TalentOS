'use client';

import React, { useState } from 'react';
import {
  getSubscriptionProducts,
  formatPrice,
  type StripeProduct,
  type BillingInterval,
} from '@/config/stripe-products';

export interface PricingTableProps {
  appId: string;
  onCheckout?: (product: StripeProduct) => void;
  theme?: 'dark' | 'light';
}

export function PricingTable({ appId, onCheckout, theme = 'dark' }: PricingTableProps) {
  const [interval, setInterval] = useState<BillingInterval>('month');
  const products = getSubscriptionProducts(appId);

  if (products.length === 0) return null;

  const isDark = theme === 'dark';
  const bg = isDark ? '#0f0f1a' : '#f8f9fa';
  const cardBg = isDark ? '#1a1a2e' : '#ffffff';
  const cardBorder = isDark ? '#2a2a3e' : '#e0e0e0';
  const accent = '#8b5cf6';
  const textPrimary = isDark ? '#e0e0e8' : '#1a1a2e';
  const textSecondary = isDark ? '#9ca3af' : '#6b7280';
  const checkColor = '#22c55e';

  function getPrice(product: StripeProduct): string {
    if (product.priceInCents === 0) return 'Free';
    if (interval === 'year' && product.annualPriceInCents != null) {
      return formatPrice(product.annualPriceInCents);
    }
    return formatPrice(product.priceInCents);
  }

  function getPriceInterval(product: StripeProduct): string {
    if (product.priceInCents === 0) return '';
    return interval === 'month' ? '/mo' : '/yr';
  }

  function getCtaLabel(product: StripeProduct): string {
    if (product.priceInCents === 0) return 'Get Started';
    const priceId =
      interval === 'year' && product.annualStripePriceId
        ? product.annualStripePriceId
        : product.stripePriceId;
    if (!priceId) return 'Coming Soon';
    if (product.trialDays) return 'Start Free Trial';
    return 'Subscribe';
  }

  function getCtaDisabled(product: StripeProduct): boolean {
    if (product.priceInCents === 0) return false;
    const priceId =
      interval === 'year' && product.annualStripePriceId
        ? product.annualStripePriceId
        : product.stripePriceId;
    return !priceId;
  }

  function handleClick(product: StripeProduct) {
    if (onCheckout) {
      onCheckout(product);
      return;
    }
    if (product.priceInCents === 0) {
      window.location.href = '/dashboard';
      return;
    }
    const priceId =
      interval === 'year' && product.annualStripePriceId
        ? product.annualStripePriceId
        : product.stripePriceId;
    if (!priceId) return;

    // Send the user to TalentOS's own Stripe checkout endpoint. Operators
    // who run multiple TalentOS-derived deployments behind a single billing
    // service can override this by setting NEXT_PUBLIC_BILLING_BASE_URL to
    // point at their shared billing host.
    const billingBase = process.env.NEXT_PUBLIC_BILLING_BASE_URL ?? '';
    const path = `/api/stripe/create-checkout-session?priceId=${priceId}&appName=${product.appId}&returnUrl=${window.location.origin}`;
    window.location.href = billingBase ? `${billingBase}${path}` : path;
  }

  const hasAnnual = products.some((p) => p.annualPriceInCents != null);
  const savingsPercent = (() => {
    const first = products.find((p) => p.annualPriceInCents != null && p.priceInCents > 0);
    if (!first) return 0;
    return Math.round(((first.priceInCents * 12 - first.annualPriceInCents!) / (first.priceInCents * 12)) * 100);
  })();

  return (
    <div style={{ background: bg, padding: '48px 16px', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
      {hasAnnual && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '12px', marginBottom: '40px' }}>
          <span
            style={{ color: interval === 'month' ? textPrimary : textSecondary, fontWeight: interval === 'month' ? 600 : 400, fontSize: '14px', cursor: 'pointer' }}
            onClick={() => setInterval('month')}
          >Monthly</span>
          <button
            onClick={() => setInterval(interval === 'month' ? 'year' : 'month')}
            style={{ position: 'relative', width: '48px', height: '26px', borderRadius: '13px', border: 'none', background: interval === 'year' ? accent : cardBorder, cursor: 'pointer', transition: 'background 0.2s', padding: 0 }}
          >
            <span style={{ position: 'absolute', top: '3px', left: interval === 'year' ? '25px' : '3px', width: '20px', height: '20px', borderRadius: '50%', background: '#ffffff', transition: 'left 0.2s' }} />
          </button>
          <span
            style={{ color: interval === 'year' ? textPrimary : textSecondary, fontWeight: interval === 'year' ? 600 : 400, fontSize: '14px', cursor: 'pointer' }}
            onClick={() => setInterval('year')}
          >Annual</span>
          {savingsPercent > 0 && (
            <span style={{ background: `${accent}22`, color: accent, fontSize: '12px', fontWeight: 600, padding: '4px 10px', borderRadius: '12px' }}>
              Save {savingsPercent}%
            </span>
          )}
        </div>
      )}

      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '24px', maxWidth: '1100px', margin: '0 auto' }}>
        {products.map((product) => {
          const isRecommended = !!product.recommended;
          const disabled = getCtaDisabled(product);

          return (
            <div
              key={product.key}
              style={{
                background: cardBg,
                border: isRecommended ? `2px solid ${accent}` : `1px solid ${cardBorder}`,
                borderRadius: '16px',
                padding: '32px 28px',
                flex: '1 1 280px',
                maxWidth: '340px',
                minWidth: '260px',
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
                boxShadow: isRecommended ? `0 0 24px ${accent}33` : '0 2px 8px rgba(0,0,0,0.08)',
              }}
            >
              {isRecommended && (
                <div style={{ position: 'absolute', top: '-13px', left: '50%', transform: 'translateX(-50%)', background: accent, color: '#ffffff', fontSize: '12px', fontWeight: 700, padding: '4px 16px', borderRadius: '12px', whiteSpace: 'nowrap' }}>
                  Most Popular
                </div>
              )}
              <div style={{ fontSize: '14px', fontWeight: 600, color: accent, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
                {product.tier}
              </div>
              <h3 style={{ fontSize: '22px', fontWeight: 700, color: textPrimary, margin: '0 0 8px 0' }}>{product.name}</h3>
              <p style={{ fontSize: '14px', color: textSecondary, margin: '0 0 20px 0', lineHeight: 1.5 }}>{product.description}</p>
              <div style={{ marginBottom: '24px' }}>
                <span style={{ fontSize: '36px', fontWeight: 800, color: textPrimary }}>{getPrice(product)}</span>
                <span style={{ fontSize: '14px', color: textSecondary }}>{getPriceInterval(product)}</span>
                {product.trialDays && product.priceInCents > 0 && (
                  <div style={{ fontSize: '12px', color: accent, marginTop: '4px' }}>{product.trialDays}-day free trial</div>
                )}
              </div>
              <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 28px 0', flex: 1 }}>
                {product.features.map((feature, i) => (
                  <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', fontSize: '14px', color: textPrimary, marginBottom: '10px', lineHeight: 1.4 }}>
                    <span style={{ color: checkColor, fontSize: '16px', lineHeight: 1.2, flexShrink: 0 }}>&#10003;</span>
                    {feature}
                  </li>
                ))}
              </ul>
              <button
                onClick={() => handleClick(product)}
                disabled={disabled}
                style={{
                  width: '100%', padding: '14px 24px', borderRadius: '10px', border: isRecommended || disabled ? 'none' : `2px solid ${accent}`,
                  fontSize: '15px', fontWeight: 700, cursor: disabled ? 'not-allowed' : 'pointer',
                  background: disabled ? cardBorder : isRecommended ? accent : 'transparent',
                  color: disabled ? textSecondary : isRecommended ? '#ffffff' : accent,
                  opacity: disabled ? 0.6 : 1, transition: 'opacity 0.2s',
                }}
              >
                {getCtaLabel(product)}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default PricingTable;
