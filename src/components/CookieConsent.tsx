"use client";

import React, { useState, useEffect } from 'react';

const STORAGE_KEY = 'cookie-consent';
const COOKIE_NAME = 'talentos_cookie_consent';
const COOKIE_DAYS = 365;

// Optional shared cookie domain. If you're running multiple TalentOS
// (or related) deployments under one parent domain and want consent to
// be shared across them, set NEXT_PUBLIC_COOKIE_DOMAIN to e.g.
// ".example.com". Default: per-host localStorage only.
function getCookieDomain(): string | null {
  const configured = process.env.NEXT_PUBLIC_COOKIE_DOMAIN;
  if (!configured) return null;
  const host = typeof window !== 'undefined' ? window.location.hostname : '';
  if (host.endsWith(configured) || `.${host}` === configured) {
    return configured;
  }
  return null;
}

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.split('; ').find((row) => row.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.split('=')[1]) : null;
}

function setSharedCookie(name: string, value: string) {
  const domain = getCookieDomain();
  const expires = new Date(Date.now() + COOKIE_DAYS * 86400 * 1000).toUTCString();
  const domainAttr = domain ? `; domain=${domain}` : '';
  const secureAttr = typeof window !== 'undefined' && window.location.protocol === 'https:' ? '; secure' : '';
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/${domainAttr}${secureAttr}; samesite=lax`;
}

function hasConsent(): boolean {
  // Check shared cookie first (when NEXT_PUBLIC_COOKIE_DOMAIN is configured).
  if (readCookie(COOKIE_NAME) === 'accepted') return true;
  // Fallback to per-host localStorage.
  if (typeof localStorage !== 'undefined' && localStorage.getItem(STORAGE_KEY) === 'accepted') return true;
  return false;
}

const CookieConsent: React.FC = () => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!hasConsent()) {
      setVisible(true);
    }
  }, []);

  const handleAccept = () => {
    // Write to both: shared cookie (when configured) and per-host localStorage.
    setSharedCookie(COOKIE_NAME, 'accepted');
    try {
      localStorage.setItem(STORAGE_KEY, 'accepted');
    } catch {
      /* privacy mode or blocked */
    }
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div style={styles.banner} role="dialog" aria-label="Cookie consent">
      <div style={styles.content}>
        <span style={styles.text}>
          We use cookies to improve your experience. Read our privacy policy for details.
        </span>
        <div style={styles.actions}>
          <a href="/privacy" style={styles.link}>
            Learn More
          </a>
          <button onClick={handleAccept} style={styles.button}>
            Accept
          </button>
        </div>
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  banner: {
    position: 'fixed',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 9998,
    background: 'rgba(0, 0, 0, 0.92)',
    backdropFilter: 'blur(8px)',
    padding: '12px 16px',
    borderTop: '1px solid rgba(255,255,255,0.1)',
  },
  content: {
    maxWidth: '960px',
    margin: '0 auto',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap' as const,
    gap: '12px',
  },
  text: {
    color: '#ffffff',
    fontSize: '13px',
    lineHeight: '1.5',
    flex: '1 1 auto',
  },
  actions: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    flexShrink: 0,
  },
  link: {
    color: '#94a3b8',
    fontSize: '13px',
    textDecoration: 'underline',
  },
  button: {
    background: '#3b82f6',
    color: '#ffffff',
    border: 'none',
    borderRadius: '6px',
    padding: '6px 16px',
    fontSize: '13px',
    fontWeight: 600,
    cursor: 'pointer',
  },
};

export default CookieConsent;
