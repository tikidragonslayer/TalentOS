/**
 * TechEasyIT Passport SDK — Cross-subdomain SSO + 2FA for consumer SaaS apps
 *
 * Drop this into any passport-enabled app to get automatic cross-domain auth.
 *
 * Usage:
 *   import { TechEasyPassport } from './passport-sdk';
 *
 *   // Initialize on app load
 *   const passport = new TechEasyPassport();
 *
 *   // Check if user is already signed in via another subdomain
 *   const user = await passport.check();
 *   if (user) {
 *     console.log('Welcome back', user.name);
 *   }
 *
 *   // After Firebase sign-in (Google/Apple/email), sync to passport
 *   const firebaseUser = await signInWithPopup(auth, provider);
 *   const idToken = await firebaseUser.user.getIdToken();
 *   await passport.createSession(idToken);
 *
 *   // Sign out everywhere
 *   await passport.logout();
 *
 *   // Listen for auth state changes
 *   passport.onAuthStateChanged((user) => {
 *     if (user) showApp(user);
 *     else showLogin();
 *   });
 *
 *   // Force profile creation on first visit (profile gate)
 *   passport.requireProfile({
 *     onMissingProfile: (user) => showProfileModal(user),
 *     checkProfile: async (uid) => {
 *       const doc = await getDoc(doc(db, 'users', uid));
 *       return doc.exists();
 *     },
 *     createProfile: async (uid, data) => {
 *       await setDoc(doc(db, 'users', uid), data);
 *     },
 *   });
 *
 *   // 2FA enrollment
 *   const { secret, otpauthUri } = await passport.enroll2FA();
 *   // Show QR code from otpauthUri, then verify:
 *   await passport.verify2FA('123456');
 *
 *   // Check 2FA status
 *   const status = await passport.get2FAStatus();
 */

export class TechEasyPassport {
  constructor(options = {}) {
    this._user = null;
    this._listeners = [];
    this._checked = false;
    this._profileConfig = null;
    this._profileChecked = new Set(); // Track which UIDs have been profile-checked

    // Base URL for passport API — auto-detected from current hostname
    this._apiBase = options.apiBase || '';

    // Optional: require 2FA before granting full access
    this._require2FA = options.require2FA || false;
  }

  // ─── Core API ──────────────────────────────────────────────────────

  /**
   * Check if user has an active passport session (from any subdomain).
   * Call this on app initialization / page load.
   *
   * Flow:
   *   1. Verify passport cookie with Worker
   *   2. If authenticated + profile gate configured → check profile
   *   3. If 2FA required + not verified → fire on2FARequired callback
   *   4. Return user (or null)
   *
   * @returns {Promise<PassportUser|null>}
   */
  async check() {
    try {
      const resp = await fetch(`${this._apiBase}/api/passport/verify`, {
        method: 'GET',
        credentials: 'include', // Send .techeasyit.com cookies
      });

      if (!resp.ok) {
        this._setUser(null);
        return null;
      }

      const data = await resp.json();

      if (data.authenticated && data.user) {
        this._setUser(data.user);
        this._checked = true;

        // Profile gate: check if user has a local profile on this app
        if (this._profileConfig && !this._profileChecked.has(data.user.uid)) {
          await this._checkProfile(data.user);
          this._profileChecked.add(data.user.uid);
        }

        // 2FA gate: if app requires 2FA and user hasn't verified
        if (this._require2FA && !data.user.mfaVerified) {
          if (this._on2FARequired) {
            this._on2FARequired(data.user);
          }
        }

        return data.user;
      }

      this._setUser(null);
      return null;
    } catch (err) {
      console.warn('[Passport] Verify failed:', err.message);
      this._setUser(null);
      return null;
    }
  }

  /**
   * Create a passport session after Firebase authentication.
   * This sets the cross-domain cookie so other subdomains recognize the user.
   *
   * @param {string} idToken - Firebase ID token from getIdToken()
   * @returns {Promise<PassportUser>}
   */
  async createSession(idToken) {
    const resp = await fetch(`${this._apiBase}/api/passport/session`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', 'X-Passport-Request': '1' },
      body: JSON.stringify({ idToken }),
    });

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({ error: 'Session creation failed' }));
      throw new Error(err.error || 'Session creation failed');
    }

    const data = await resp.json();

    if (data.success && data.user) {
      this._setUser(data.user);

      // Profile gate on session creation too
      if (this._profileConfig && !this._profileChecked.has(data.user.uid)) {
        await this._checkProfile(data.user);
        this._profileChecked.add(data.user.uid);
      }

      return data.user;
    }

    throw new Error('Unexpected response from passport');
  }

  /**
   * Clear the passport session (sign out across all subdomains).
   */
  async logout() {
    try {
      await fetch(`${this._apiBase}/api/passport/logout`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'X-Passport-Request': '1' },
      });
    } catch {
      // Best effort — cookie will expire anyway
    }
    this._profileChecked.clear();
    this._setUser(null);
  }

  /**
   * Get the current passport user (synchronous, from last check).
   * @returns {PassportUser|null}
   */
  get currentUser() {
    return this._user;
  }

  /**
   * Register a callback for auth state changes.
   * @param {function(PassportUser|null): void} callback
   * @returns {function} Unsubscribe function
   */
  onAuthStateChanged(callback) {
    this._listeners.push(callback);

    // If already checked, fire immediately
    if (this._checked) {
      callback(this._user);
    }

    // Return unsubscribe function
    return () => {
      this._listeners = this._listeners.filter(cb => cb !== callback);
    };
  }

  // ─── 2FA (TOTP) ─────────────────────────────────────────────────────

  /**
   * Enroll in TOTP 2FA. Returns the secret and otpauth:// URI for QR code.
   * User must verify with a code within 10 minutes to confirm enrollment.
   *
   * @returns {Promise<{ secret: string, otpauthUri: string, expiresIn: number }>}
   */
  async enroll2FA() {
    const resp = await fetch(`${this._apiBase}/api/passport/enroll-2fa`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'X-Passport-Request': '1' },
    });

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({ error: '2FA enrollment failed' }));
      throw new Error(err.error || '2FA enrollment failed');
    }

    return resp.json();
  }

  /**
   * Verify a 6-digit TOTP code. On first call after enrollment, this confirms
   * the enrollment. On subsequent calls, this upgrades the session to MFA-verified.
   *
   * @param {string} code - 6-digit TOTP code from authenticator app
   * @returns {Promise<{ success: boolean, mfaVerified: boolean, message: string }>}
   */
  async verify2FA(code) {
    if (!code || !/^\d{6}$/.test(code)) {
      throw new Error('Code must be a 6-digit string');
    }

    const resp = await fetch(`${this._apiBase}/api/passport/verify-2fa`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', 'X-Passport-Request': '1' },
      body: JSON.stringify({ code }),
    });

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({ error: 'Verification failed' }));
      throw new Error(err.error || 'Verification failed');
    }

    const data = await resp.json();

    // Refresh user state since session was upgraded
    if (data.success) {
      await this.check();
    }

    return data;
  }

  /**
   * Get the current 2FA enrollment/verification status.
   *
   * @returns {Promise<TwoFactorStatus>}
   */
  async get2FAStatus() {
    const resp = await fetch(`${this._apiBase}/api/passport/2fa-status`, {
      method: 'GET',
      credentials: 'include',
    });

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({ error: 'Status check failed' }));
      throw new Error(err.error || 'Status check failed');
    }

    return resp.json();
  }

  /**
   * Register a callback for when 2FA is required but not yet verified.
   * Use with require2FA: true in constructor options.
   *
   * @param {function(PassportUser): void} callback
   */
  on2FARequired(callback) {
    this._on2FARequired = callback;
  }

  // ─── Billing (Centralized Stripe via Passport) ─────────────────────

  /**
   * Get or create a Stripe customer linked to this passport user.
   * One customer ID shared across all TechEasy apps.
   *
   * @returns {Promise<{ customerId: string, email: string }>}
   */
  async getOrCreateCustomer() {
    const resp = await fetch(`${this._apiBase}/api/passport/billing/customer`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', 'X-Passport-Request': '1' },
      body: JSON.stringify({}),
    });

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({ error: 'Customer creation failed' }));
      throw new Error(err.error || 'Customer creation failed');
    }

    return resp.json();
  }

  /**
   * List all active subscriptions for this user across all TechEasy apps.
   *
   * @returns {Promise<{ subscriptions: Subscription[] }>}
   */
  async getSubscriptions() {
    const resp = await fetch(`${this._apiBase}/api/passport/billing/subscriptions`, {
      method: 'GET',
      credentials: 'include',
    });

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({ error: 'Failed to fetch subscriptions' }));
      throw new Error(err.error || 'Failed to fetch subscriptions');
    }

    return resp.json();
  }

  /**
   * Open the Stripe Customer Portal where user can manage ALL subscriptions
   * across all TechEasy apps in one place.
   *
   * @param {string} [returnUrl] - URL to return to after portal session
   * @returns {Promise<void>} Redirects the browser to Stripe portal
   */
  async openBillingPortal(returnUrl) {
    const resp = await fetch(`${this._apiBase}/api/passport/billing/portal`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', 'X-Passport-Request': '1' },
      body: JSON.stringify({ returnUrl: returnUrl || window.location.href }),
    });

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({ error: 'Portal unavailable' }));
      throw new Error(err.error || 'Portal unavailable');
    }

    const { url } = await resp.json();
    window.location.href = url;
  }

  /**
   * Create a Stripe Checkout session for a subscription or one-time purchase.
   * Passport users automatically get 33% off (PASSPORT33 coupon).
   * Supports Apple Pay + Google Pay automatically.
   *
   * @param {string} priceId - Stripe price ID for the product
   * @param {string} [app] - App name (e.g., 'herbal-bridge')
   * @param {Object} [options] - Optional { successUrl, cancelUrl, mode }
   * @param {string} [options.mode] - 'subscription' (default) or 'payment' for one-time
   * @returns {Promise<void>} Redirects to Stripe Checkout
   */
  async checkout(priceId, app, options = {}) {
    const resp = await fetch(`${this._apiBase}/api/passport/billing/checkout`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', 'X-Passport-Request': '1' },
      body: JSON.stringify({
        priceId,
        app: app || window.location.hostname,
        successUrl: options.successUrl,
        cancelUrl: options.cancelUrl,
        mode: options.mode,
      }),
    });

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({ error: 'Checkout failed' }));
      throw new Error(err.error || 'Checkout failed');
    }

    const { url } = await resp.json();
    window.location.href = url;
  }

  /**
   * Check if current user has an active subscription for a specific app.
   *
   * @param {string} appName - App identifier (e.g., 'herbal-bridge')
   * @returns {Promise<boolean>}
   */
  async hasSubscription(appName) {
    try {
      const { subscriptions } = await this.getSubscriptions();
      return subscriptions.some(
        s => s.app === appName && (s.status === 'active' || s.status === 'trialing')
      );
    } catch {
      return false;
    }
  }

  // ─── Account Deletion ─────────────────────────────────────────────

  /**
   * Permanently delete the user's TechEasyIT Passport account.
   * This cancels ALL subscriptions, deletes ALL data across every TechEasyIT
   * app, clears billing, 2FA, referrals, tax records, and signs out everywhere.
   *
   * THIS ACTION IS IRREVERSIBLE.
   *
   * @param {string} confirmPhrase - Must be exactly "DELETE MY ACCOUNT"
   * @returns {Promise<{ success: boolean, message: string, details: string[] }>}
   */
  async deleteAccount(confirmPhrase) {
    if (confirmPhrase !== 'DELETE MY ACCOUNT') {
      throw new Error('You must pass the exact phrase "DELETE MY ACCOUNT" to confirm deletion.');
    }

    const resp = await fetch(`${this._apiBase}/api/passport/account/delete`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', 'X-Passport-Request': '1' },
      body: JSON.stringify({ confirmPhrase }),
    });

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({ error: 'Account deletion failed' }));
      throw new Error(err.error || 'Account deletion failed');
    }

    const data = await resp.json();

    // Clear local state
    this._profileChecked.clear();
    this._setUser(null);

    return data;
  }

  // ─── Central Auth Redirect ─────────────────────────────────────────

  /**
   * Redirect to the central TechEasy login/register page.
   * After authentication, user is redirected back to the current page.
   *
   * Usage:
   *   // On "Register" button click:
   *   passport.redirectToAuth('register');
   *
   *   // On "Login" button click:
   *   passport.redirectToAuth('login');
   *
   * @param {'login'|'register'} [action='login'] - Auth action hint
   * @param {string} [returnUrl] - URL to return to (defaults to current page)
   */
  redirectToAuth(action = 'login', returnUrl) {
    const ret = returnUrl || window.location.href;
    const authUrl = `https://dash.techeasyit.com/api/passport/auth/redirect?return=${encodeURIComponent(ret)}&action=${action}`;
    window.location.href = authUrl;
  }

  // ─── Referral System ──────────────────────────────────────────────

  /**
   * Get the current user's referral code and link.
   *
   * @returns {Promise<{ code: string, link: string }>}
   */
  async getReferralCode() {
    const resp = await fetch(`${this._apiBase}/api/passport/referral/code`, {
      method: 'GET',
      credentials: 'include',
    });

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({ error: 'Failed to get referral code' }));
      throw new Error(err.error || 'Failed to get referral code');
    }

    return resp.json();
  }

  /**
   * Track a referral (call after signup when referral cookie is present).
   * The Worker automatically stores a `techeasyit_ref` cookie when ?ref= is in the URL.
   *
   * @returns {Promise<{ success: boolean }>}
   */
  async trackReferral() {
    // Read the referral cookie (it's not httpOnly so JS can read it)
    const match = document.cookie.match(/techeasyit_ref=([^;]+)/);
    if (!match) return { success: false, message: 'No referral cookie' };

    const resp = await fetch(`${this._apiBase}/api/passport/referral/track`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', 'X-Passport-Request': '1' },
      body: JSON.stringify({ referralCode: match[1] }),
    });

    if (!resp.ok) {
      return { success: false };
    }

    // Clear the referral cookie after tracking
    const domain = window.location.hostname.includes('ghostmatch.boo')
      ? '.ghostmatch.boo' : '.techeasyit.com';
    document.cookie = `techeasyit_ref=; Domain=${domain}; Path=/; Max-Age=0`;

    return resp.json();
  }

  /**
   * Get referral stats for the current user.
   *
   * @returns {Promise<ReferralStats>}
   */
  async getReferralStats() {
    const resp = await fetch(`${this._apiBase}/api/passport/referral/stats`, {
      method: 'GET',
      credentials: 'include',
    });

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({ error: 'Failed to get referral stats' }));
      throw new Error(err.error || 'Failed to get referral stats');
    }

    return resp.json();
  }

  // ─── KYC (Stripe Identity Verification) ────────────────────────────

  /**
   * Start KYC identity verification. Required before any money exchange.
   * Returns a Stripe Identity verification URL — redirect the user there.
   *
   * @param {string} returnUrl - URL to return to after verification
   * @returns {Promise<{verificationSessionId: string, url: string} | {alreadyVerified: true}>}
   */
  async startKyc(returnUrl) {
    const resp = await fetch(`${this._apiBase}/api/passport/kyc/start`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', 'X-Passport-Request': '1' },
      body: JSON.stringify({ returnUrl }),
    });

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({ error: 'KYC start failed' }));
      throw new Error(err.error || 'KYC start failed');
    }

    return resp.json();
  }

  // ── Trust Nexus ────────────────────────────────────────────────────────

  /**
   * Get the user's Trust Nexus rank badge.
   * Returns rank name only (never the numeric score).
   * @returns {Promise<{rank: string|null, badge: string|null}>}
   */
  async getTrustTier() {
    try {
      const resp = await fetch(`${this._apiBase}/api/passport/trust/tier`, {
        method: 'GET',
        credentials: 'include',
      });
      if (!resp.ok) return { rank: null, badge: null };
      return await resp.json();
    } catch {
      return { rank: null, badge: null };
    }
  }

  // ── KYC / Identity ────────────────────────────────────────────────────

  /**
   * Check KYC verification status.
   * @returns {Promise<{verified: boolean, status: string, verifiedAt: string|null}>}
   */
  async getKycStatus() {
    const resp = await fetch(`${this._apiBase}/api/passport/kyc/status`, {
      method: 'GET',
      credentials: 'include',
    });

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({ error: 'KYC status check failed' }));
      throw new Error(err.error || 'KYC status check failed');
    }

    return resp.json();
  }

  /**
   * Submit W-9 information. Required before receiving payouts.
   * NEVER send full SSN/EIN — only last 4 digits.
   *
   * @param {Object} w9 - W-9 data
   * @param {'ssn'|'ein'} w9.tinType
   * @param {string} w9.tinLast4 - Last 4 digits only
   * @param {string} w9.legalName
   * @param {string} [w9.businessName]
   * @returns {Promise<{success: boolean, w9Collected: boolean}>}
   */
  async submitW9({ tinType, tinLast4, legalName, businessName }) {
    const resp = await fetch(`${this._apiBase}/api/passport/kyc/w9`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', 'X-Passport-Request': '1' },
      body: JSON.stringify({ tinType, tinLast4, legalName, businessName }),
    });

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({ error: 'W-9 submission failed' }));
      throw new Error(err.error || 'W-9 submission failed');
    }

    return resp.json();
  }

  /**
   * Gate a payment flow behind KYC. Call this before any checkout.
   * If not verified, redirects to KYC verification. Returns true if verified.
   *
   * @param {string} [returnUrl] - Where to return after KYC (defaults to current page)
   * @returns {Promise<boolean>} - true if KYC verified, false if redirecting to verify
   */
  async requireKyc(returnUrl) {
    const status = await this.getKycStatus();
    if (status.verified) return true;

    const result = await this.startKyc(returnUrl || window.location.href);
    if (result.alreadyVerified) return true;

    // Redirect to Stripe Identity verification
    window.location.href = result.url;
    return false;
  }

  // ─── Tax Summary ─────────────────────────────────────────────────────

  /**
   * Get tax summary for the authenticated user.
   * @param {number} [year] - Tax year (defaults to current year)
   * @returns {Promise<Object>} Tax summary with totals, app breakdown, 1099 flags
   */
  async getTaxSummary(year) {
    const params = year ? `?year=${year}` : '';
    const resp = await fetch(`${this._apiBase}/api/passport/tax/summary${params}`, {
      method: 'GET',
      credentials: 'include',
    });

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({ error: 'Tax summary failed' }));
      throw new Error(err.error || 'Tax summary failed');
    }

    return resp.json();
  }

  /**
   * Get transaction history for the authenticated user.
   * @param {Object} [options]
   * @param {number} [options.year]
   * @param {string} [options.app] - Filter by app ID
   * @param {number} [options.limit] - Max results (default 50, max 100)
   * @returns {Promise<{year: number, total: number, transactions: Array}>}
   */
  async getTaxTransactions({ year, app, limit } = {}) {
    const params = new URLSearchParams();
    if (year) params.set('year', year);
    if (app) params.set('app', app);
    if (limit) params.set('limit', limit);
    const qs = params.toString() ? `?${params}` : '';

    const resp = await fetch(`${this._apiBase}/api/passport/tax/transactions${qs}`, {
      method: 'GET',
      credentials: 'include',
    });

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({ error: 'Transaction fetch failed' }));
      throw new Error(err.error || 'Transaction fetch failed');
    }

    return resp.json();
  }

  // ─── Profile Enforcement (Profile Gate) ──────────────────────────────

  /**
   * Configure the profile gate. When a passport user arrives at this app
   * for the first time (authenticated via SSO but no local profile),
   * the onMissingProfile callback fires so you can show a profile modal.
   *
   * This is the KEY flow for: "User comes from another site, has passport,
   * but doesn't have a profile on THIS app."
   *
   * @param {Object} config
   * @param {function(string): Promise<boolean>} config.checkProfile
   *   Async function that returns true if a profile exists for the uid.
   *   Example: check Firestore `users/{uid}` collection for this app.
   *
   * @param {function(PassportUser): void} config.onMissingProfile
   *   Called when user is authenticated but has no local profile.
   *   Show a profile creation modal/page here. The user object contains
   *   uid, email, name, picture from their passport — pre-fill the form.
   *
   * @param {function(string, Object): Promise<void>} [config.createProfile]
   *   Optional async function to create the profile. If provided, the SDK
   *   can auto-create minimal profiles or be called from your modal.
   *
   * @param {boolean} [config.blockUntilComplete=false]
   *   If true, the check() promise won't resolve until profile exists.
   *   If false (default), check() resolves immediately and onMissingProfile
   *   fires asynchronously — your app decides how to handle it.
   *
   * Usage pattern in your React app:
   *
   *   passport.requireProfile({
   *     checkProfile: async (uid) => {
   *       const snap = await getDoc(doc(db, 'users', uid));
   *       return snap.exists();
   *     },
   *     onMissingProfile: (user) => {
   *       // user.uid, user.email, user.name, user.picture are available
   *       // Show profile creation modal pre-filled with passport data
   *       setShowProfileModal(true);
   *       setPassportUser(user);
   *     },
   *   });
   */
  requireProfile(config) {
    this._profileConfig = config;

    // If user is already set, check now
    if (this._user && !this._profileChecked.has(this._user.uid)) {
      this._checkProfile(this._user);
      this._profileChecked.add(this._user.uid);
    }
  }

  // ─── CPACE: Cognitive Profile Adaptive Content Engine ──────────────

  /**
   * Check if the user has completed the cognitive assessment.
   * @returns {Promise<boolean>}
   */
  async hasCognitiveProfile() {
    try {
      const resp = await fetch(`${this._apiBase}/api/passport/cognitive/profile`, {
        method: 'GET',
        credentials: 'include',
      });
      if (!resp.ok) return false;
      const data = await resp.json();
      return data.assessed === true;
    } catch {
      return false;
    }
  }

  /**
   * Get the user's cognitive profile. Returns the default 4th-grade profile
   * if user hasn't taken the assessment (or isn't logged in).
   *
   * The profile includes readingTier and readingGrade for internal SDK use,
   * but apps should NEVER display the grade to users.
   *
   * @returns {Promise<CognitiveProfile>}
   */
  async getCognitiveProfile() {
    try {
      const resp = await fetch(`${this._apiBase}/api/passport/cognitive/profile`, {
        method: 'GET',
        credentials: 'include',
      });
      if (!resp.ok) return { profile: null, assessed: false };
      return await resp.json();
    } catch {
      return { profile: null, assessed: false };
    }
  }

  /**
   * Submit assessment answers and compute the cognitive profile.
   * Stores the result in Passport KV for cross-app access.
   *
   * Returns user-facing results: MBTI type, personality label, trait badges.
   * NEVER returns reading level/grade to the client display layer.
   *
   * @param {Object} answers
   * @param {Array<'simple'|'complex'>} answers.reading - 6 reading preference answers
   * @param {Array<{itemId: string, axis: string, polePicked: string}>} answers.mbti - 8 MBTI answers
   * @param {Array<{itemId: string, trait: string, value: number, reversed: boolean}>} answers.big5 - 10 Big 5 answers
   * @returns {Promise<{success: boolean, profile: {mbtiType: string, label: string, traits: string[]}}>}
   */
  async submitAssessment(answers) {
    const resp = await fetch(`${this._apiBase}/api/passport/cognitive/assess`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', 'X-Passport-Request': '1' },
      body: JSON.stringify({ answers }),
    });

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({ error: 'Assessment submission failed' }));
      throw new Error(err.error || 'Assessment submission failed');
    }

    return resp.json();
  }

  /**
   * Adapt content blocks for the current user's cognitive profile.
   * Sends original text to the CPACE engine, which returns adapted text
   * matching the user's reading level, personality, and communication style.
   *
   * If the user hasn't taken the assessment, content is adapted to 4th-grade
   * reading level by default — ensuring maximum accessibility.
   *
   * GUARANTEE: Adapted content contains 100% of the original meaning.
   * Simpler language = clearer expression, NEVER less information.
   *
   * @param {string} appId - Unique identifier for the calling app
   * @param {Array<{id: string, text: string}>} blocks - Content blocks to adapt
   * @returns {Promise<{blocks: Array<{id: string, text: string, cached: boolean}>}>}
   */
  async adaptContent(appId, blocks) {
    try {
      const resp = await fetch(`${this._apiBase}/api/passport/cognitive/adapt`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', 'X-Passport-Request': '1' },
        body: JSON.stringify({ appId, blocks }),
      });

      if (!resp.ok) {
        // Graceful fallback: return original blocks
        return { blocks: blocks.map(b => ({ ...b, cached: false, fallback: true })) };
      }

      return await resp.json();
    } catch {
      // Network error: return original blocks
      return { blocks: blocks.map(b => ({ ...b, cached: false, fallback: true })) };
    }
  }

  /**
   * Register a callback for when cognitive assessment is needed.
   * Fires when the user is authenticated but hasn't completed the assessment.
   *
   * @param {function(PassportUser): void} callback
   */
  onAssessmentRequired(callback) {
    this._onAssessmentRequired = callback;

    // If user is already set and hasn't assessed, fire immediately
    if (this._user) {
      this.hasCognitiveProfile().then(has => {
        if (!has && this._onAssessmentRequired) {
          this._onAssessmentRequired(this._user);
        }
      });
    }
  }

  // ─── Ikigai: Career Discovery + Market Intelligence ────────────────

  /**
   * Submit Ikigai assessment answers and store the computed career profile.
   * The scoring happens client-side; this stores the results in Passport KV.
   *
   * @param {Object} answers - Raw answers keyed by question ID
   * @param {Object} ikigaiProfile - The fully scored Ikigai profile
   * @returns {Promise<{success: boolean, sweetSpot: Object, topRoles: Array}>}
   */
  async submitIkigai(answers, ikigaiProfile) {
    const resp = await fetch(`${this._apiBase}/api/passport/ikigai/assess`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', 'X-Passport-Request': '1' },
      body: JSON.stringify({ answers, ikigaiProfile }),
    });

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({ error: 'Ikigai submission failed' }));
      throw new Error(err.error || 'Ikigai submission failed');
    }

    return resp.json();
  }

  /**
   * Get the user's Ikigai career profile.
   * @returns {Promise<{profile: Object|null, assessed: boolean}>}
   */
  async getIkigaiProfile() {
    try {
      const resp = await fetch(`${this._apiBase}/api/passport/ikigai/profile`, {
        method: 'GET',
        credentials: 'include',
      });
      if (!resp.ok) return { profile: null, assessed: false };
      return await resp.json();
    } catch {
      return { profile: null, assessed: false };
    }
  }

  /**
   * Get real-time job market intelligence matching the user's strengths.
   * Queries Perplexity API anonymously — NO personal data is sent,
   * only generic skill/industry keywords.
   * Results cached 24 hours.
   *
   * @param {Object} params
   * @param {string[]} params.strengths - Top strengths
   * @param {string[]} params.skills - Top skills
   * @param {string[]} [params.industries] - Industries of interest
   * @param {string} [params.archetype] - Career archetype title
   * @returns {Promise<{intel: Object|null, cached: boolean}>}
   */
  async getMarketIntelligence({ strengths, skills, industries, archetype }) {
    try {
      const resp = await fetch(`${this._apiBase}/api/passport/ikigai/market-intel`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', 'X-Passport-Request': '1' },
        body: JSON.stringify({ strengths, skills, industries, archetype }),
      });

      if (!resp.ok) return { intel: null, cached: false, fallback: true };
      return await resp.json();
    } catch {
      return { intel: null, cached: false, fallback: true };
    }
  }

  // ─── PPI Vault (Blockchain-backed identity) ───────────────────────

  /**
   * Link a Solana wallet to Passport for PPI vault storage.
   * Wallet ownership is verified client-side via signature.
   *
   * @param {string} walletAddress - Solana wallet address (base58)
   * @param {string} signature - Message signature proving ownership
   * @param {string} message - The message that was signed
   * @returns {Promise<{success: boolean, walletAddress: string}>}
   */
  async linkWallet(walletAddress, signature, message) {
    const resp = await fetch(`${this._apiBase}/api/passport/vault/link-wallet`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', 'X-Passport-Request': '1' },
      body: JSON.stringify({ walletAddress, signature, message }),
    });

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({ error: 'Wallet linking failed' }));
      throw new Error(err.error || 'Wallet linking failed');
    }

    return resp.json();
  }

  /**
   * Record that PPI data has been stored on Solana blockchain.
   * The actual encryption and transaction happen client-side.
   *
   * @param {string} encryptedRef - Encrypted reference to on-chain data
   * @param {string} onChainTxId - Solana transaction ID
   * @returns {Promise<{success: boolean, vaultVersion: number}>}
   */
  async storePPIOnChain(encryptedRef, onChainTxId) {
    const resp = await fetch(`${this._apiBase}/api/passport/vault/store`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', 'X-Passport-Request': '1' },
      body: JSON.stringify({ encryptedRef, onChainTxId }),
    });

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({ error: 'Vault storage failed' }));
      throw new Error(err.error || 'Vault storage failed');
    }

    return resp.json();
  }

  /**
   * Get PPI vault status — wallet linked, on-chain storage status.
   *
   * @returns {Promise<{walletLinked: boolean, onChainStored: boolean, walletAddress: string|null}>}
   */
  async getVaultStatus() {
    try {
      const resp = await fetch(`${this._apiBase}/api/passport/vault/status`, {
        method: 'GET',
        credentials: 'include',
      });
      if (!resp.ok) return { walletLinked: false, onChainStored: false, walletAddress: null };
      return await resp.json();
    } catch {
      return { walletLinked: false, onChainStored: false, walletAddress: null };
    }
  }

  // ─── Composite Index (Trust + Intelligence + Merit) ───────────────

  /**
   * Get the user's composite rank across Trust Nexus, cognitive profile, and merit.
   * Priority: Trust (50%) > Intelligence (30%) > Merit (20%)
   *
   * @returns {Promise<{compositeTier: string, compositeScore: number, trustRank: string|null}>}
   */
  async getCompositeRank() {
    try {
      const resp = await fetch(`${this._apiBase}/api/passport/index/rank`, {
        method: 'GET',
        credentials: 'include',
      });
      if (!resp.ok) return { compositeTier: 'C', compositeScore: 0, trustRank: null };
      return await resp.json();
    } catch {
      return { compositeTier: 'C', compositeScore: 0, trustRank: null };
    }
  }

  // ─── Spectrum IQ (Multi-Dimensional Intelligence Index) ─────────────

  /**
   * Get the user's full Spectrum IQ profile (8 dimensions + composite).
   * Returns passive-only scores if no active assessment taken.
   * Computes on demand if stale or missing.
   *
   * @returns {Promise<{assessed: boolean, spectrum: object|null, signalSources: object, interpretation: string[]}>}
   */
  async getSpectrumProfile() {
    try {
      const resp = await fetch(`${this._apiBase}/api/passport/spectrum/profile`, {
        method: 'GET',
        credentials: 'include',
      });
      if (!resp.ok) return { assessed: false, spectrum: null, signalSources: {}, interpretation: [] };
      return await resp.json();
    } catch {
      return { assessed: false, spectrum: null, signalSources: {}, interpretation: [] };
    }
  }

  /**
   * Get lightweight Spectrum badge data for the EcosystemFooter widget.
   * Returns null if no Spectrum data exists.
   *
   * @returns {Promise<{tier: string, label: string, topDimension: string, confidence: number}|null>}
   */
  async getSpectrumBadge() {
    try {
      const resp = await fetch(`${this._apiBase}/api/passport/spectrum/badge`, {
        method: 'GET',
        credentials: 'include',
      });
      if (!resp.ok) return null;
      return await resp.json();
    } catch {
      return null;
    }
  }

  /**
   * Submit Spectrum Challenge answers and compute full profile.
   *
   * @param {object} answers - { patternChallenge: [...], scenarioJudgment: [...], creativeProblem: [...] }
   * @param {string} [startedAt] - ISO timestamp of when assessment started
   * @returns {Promise<{success: boolean, spectrum: object, interpretation: string[]}>}
   */
  async submitSpectrumAssessment(answers, startedAt) {
    const resp = await fetch(`${this._apiBase}/api/passport/spectrum/assess`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', 'X-Passport-Request': '1' },
      body: JSON.stringify({ answers, startedAt }),
    });
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({ error: 'Assessment failed' }));
      throw new Error(err.error || 'Assessment failed');
    }
    return await resp.json();
  }

  /**
   * Get the Spectrum Codex directory (public-facing).
   *
   * @param {object} [options] - { page, limit, tier }
   * @returns {Promise<{members: Array, totalMembers: number, tierDistribution: object}>}
   */
  async getSpectrumCodex(options = {}) {
    const params = new URLSearchParams();
    if (options.page) params.set('page', String(options.page));
    if (options.limit) params.set('limit', String(options.limit));
    if (options.tier) params.set('tier', options.tier);

    try {
      const resp = await fetch(`${this._apiBase}/api/passport/spectrum/codex?${params}`, {
        method: 'GET',
        credentials: 'include',
      });
      if (!resp.ok) return { members: [], totalMembers: 0, tierDistribution: {} };
      return await resp.json();
    } catch {
      return { members: [], totalMembers: 0, tierDistribution: {} };
    }
  }

  /**
   * Get recommended apps sorted by affinity for the user's Spectrum profile.
   *
   * @param {string} [currentAppId] - Current app to exclude from results
   * @returns {Promise<{apps: Array, personalized: boolean}>}
   */
  async getRecommendedApps(currentAppId) {
    const params = currentAppId ? `?current=${encodeURIComponent(currentAppId)}` : '';
    try {
      const resp = await fetch(`${this._apiBase}/api/passport/spectrum/recommend${params}`, {
        method: 'GET',
        credentials: 'include',
      });
      if (!resp.ok) return { apps: [], personalized: false };
      return await resp.json();
    } catch {
      return { apps: [], personalized: false };
    }
  }

  /**
   * Check if the user has completed the Spectrum Challenge.
   * @returns {Promise<boolean>}
   */
  async hasSpectrumAssessment() {
    const profile = await this.getSpectrumProfile();
    return profile?.assessed === true;
  }

  /**
   * Register callback for when Spectrum assessment is recommended.
   * Fires when user has auth but low confidence (passive-only data).
   *
   * @param {function} callback - Called with current confidence (0-1)
   * @returns {function} Unsubscribe function
   */
  onSpectrumRecommended(callback) {
    const check = async (user) => {
      if (!user) return;
      try {
        const badge = await this.getSpectrumBadge();
        if (!badge || badge.confidence < 0.6) {
          callback(badge?.confidence || 0);
        }
      } catch { /* silent */ }
    };
    return this.onAuthStateChanged(check);
  }

  // ─── Internal ──────────────────────────────────────────────────────

  _setUser(user) {
    const prev = this._user;
    this._user = user;

    // Only notify if state actually changed
    if (JSON.stringify(prev) !== JSON.stringify(user)) {
      this._listeners.forEach(cb => {
        try { cb(user); } catch (e) { console.error('[Passport] Listener error:', e); }
      });
    }
  }

  async _checkProfile(user) {
    if (!this._profileConfig) return;

    try {
      const exists = await this._profileConfig.checkProfile(user.uid);
      if (!exists && this._profileConfig.onMissingProfile) {
        this._profileConfig.onMissingProfile(user);
      }
    } catch (err) {
      console.warn('[Passport] Profile check failed:', err.message);
    }
  }

  // ─── Onboarding & Profile ──────────────────────────────────────────

  /**
   * Redirect to the central onboarding wizard on dash.techeasyit.com.
   * After completion, user is redirected back to the return URL.
   *
   * @param {string} [returnUrl] - URL to return to after onboarding (defaults to current page)
   * @param {string} [source] - App name for referral tracking (e.g., 'resume-ink')
   */
  redirectToOnboarding(returnUrl, source) {
    const ret = returnUrl || window.location.href;
    let onboardingUrl = `https://dash.techeasyit.com/onboarding?return=${encodeURIComponent(ret)}`;
    if (source) {
      onboardingUrl += `&source=${encodeURIComponent(source)}`;
    }
    window.location.href = onboardingUrl;
  }

  /**
   * Get the current user's cross-domain profile from Passport KV.
   *
   * @returns {Promise<PassportProfile|null>}
   */
  async getProfile() {
    try {
      const resp = await fetch(`${this._apiBase}/api/passport/profile`, {
        method: 'GET',
        credentials: 'include',
      });
      if (!resp.ok) return null;
      const data = await resp.json();
      return data.profile || null;
    } catch {
      return null;
    }
  }

  /**
   * Create or update the user's cross-domain profile.
   * First call sets onboardedAt and marks the user as onboarded.
   *
   * @param {Partial<PassportProfile>} fields - Profile fields to update
   * @returns {Promise<{success: boolean, profile: PassportProfile}>}
   */
  async updateProfile(fields) {
    const resp = await fetch(`${this._apiBase}/api/passport/profile`, {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', 'X-Passport-Request': '1' },
      body: JSON.stringify(fields),
    });

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({ error: 'Profile update failed' }));
      throw new Error(err.error || 'Profile update failed');
    }

    return resp.json();
  }

  /**
   * Check if the current user has completed onboarding.
   * Uses the isOnboarded flag from the verify response (no extra API call).
   *
   * @returns {Promise<boolean>}
   */
  async isOnboarded() {
    const user = await this.check();
    return user?.isOnboarded || false;
  }

  /**
   * Gate: redirect to onboarding if user is authenticated but hasn't onboarded.
   * Returns true if user is onboarded (or not authenticated). Returns false if redirecting.
   *
   * @param {string} [returnUrl] - URL to return to after onboarding
   * @param {string} [source] - App name for tracking
   * @returns {Promise<boolean>} - true if ready, false if redirecting
   */
  async requireOnboarding(returnUrl, source) {
    const user = await this.check();
    if (user && !user.isOnboarded) {
      this.redirectToOnboarding(returnUrl || window.location.href, source);
      return false; // redirecting
    }
    return true; // already onboarded or not authenticated
  }

  /**
   * Upload an avatar image. Stored in Passport KV, served via a public URL.
   *
   * @param {File} file - Image file (JPEG, PNG, or WebP, max 2MB)
   * @returns {Promise<{success: boolean, avatarUrl: string}>}
   */
  async uploadAvatar(file) {
    const formData = new FormData();
    formData.append('avatar', file);

    const resp = await fetch(`${this._apiBase}/api/passport/profile/avatar`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'X-Passport-Request': '1' },
      body: formData,
    });

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({ error: 'Avatar upload failed' }));
      throw new Error(err.error || 'Avatar upload failed');
    }

    return resp.json();
  }

  // ─── Life Raft (Connection Health & Isolation Prevention) ─────────────

  /**
   * Record a heartbeat (app visit) for connection health tracking.
   * Called automatically by PassportWrapper on mount. Fire-and-forget.
   *
   * @param {string} appName - The app identifier (e.g., 'tagwise', 'proximity')
   * @param {Object} [context] - Optional context for help request classification
   * @param {string} [context.helpCategory] - Trust Nexus help category
   * @param {string} [context.helpDescription] - Help request description text
   * @returns {Promise<void>}
   */
  async recordHeartbeat(appName, context) {
    try {
      const body = { app: appName };
      if (context?.helpCategory) body.helpCategory = context.helpCategory;
      if (context?.helpDescription) body.helpDescription = context.helpDescription;
      await fetch(`${this._apiBase}/api/passport/liferaft/heartbeat`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', 'X-Passport-Request': '1' },
        body: JSON.stringify(body),
      });
    } catch {
      // Silent fail — heartbeat is best-effort, never blocks user
    }
  }

  /**
   * Get the Life Raft recommendation for the current user.
   * Returns null if the user is well-connected or has opted out.
   * NEVER returns raw scores or signal breakdowns.
   *
   * @returns {Promise<{tier: string, recommendation: {app: string, url: string, message: string}|null, optedOut: boolean}|null>}
   */
  async getLifeRaftRecommendation() {
    try {
      const resp = await fetch(`${this._apiBase}/api/passport/liferaft/status`, {
        method: 'GET',
        credentials: 'include',
      });
      if (!resp.ok) return null;
      return resp.json();
    } catch {
      return null;
    }
  }

  /**
   * Opt out of (or back into) Life Raft banner recommendations.
   * Opted-out users still have heartbeats recorded (general analytics).
   * The structural guarantee remains: apps still exist and are discoverable.
   *
   * @param {boolean} optOut - true to opt out, false to opt back in
   * @returns {Promise<{success: boolean, optedOut: boolean}>}
   */
  async setLifeRaftOptOut(optOut) {
    const resp = await fetch(`${this._apiBase}/api/passport/liferaft/optout`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', 'X-Passport-Request': '1' },
      body: JSON.stringify({ optOut }),
    });
    if (!resp.ok) throw new Error('Failed to update Life Raft preference');
    return resp.json();
  }
}

/**
 * @typedef {Object} PassportProfile
 * @property {string} displayName    - Display name (2-50 chars)
 * @property {string|null} avatarUrl - URL to avatar image
 * @property {string} timezone       - IANA timezone (e.g., 'America/New_York')
 * @property {boolean} notifyEmail   - Email notification preference
 * @property {string} locale         - Locale string (e.g., 'en-US')
 * @property {string} onboardedAt   - ISO 8601 timestamp of onboarding completion
 * @property {string} updatedAt     - ISO 8601 timestamp of last update
 * @property {string|null} referralSource - Which app referred the user to onboarding
 */

/**
 * @typedef {Object} PassportUser
 * @property {string} uid           - Firebase UID
 * @property {string} email         - User's email
 * @property {string} name          - Display name
 * @property {string} picture       - Avatar URL
 * @property {string} provider      - Auth provider (google.com, apple.com, password, etc.)
 * @property {boolean} mfaVerified  - Whether 2FA was verified this session
 * @property {string} mfaMethod     - MFA method used ('totp', 'phone', 'none')
 * @property {boolean} totpEnrolled - Whether TOTP 2FA is enrolled
 * @property {boolean} isOnboarded  - Whether user has completed core onboarding
 */

/**
 * @typedef {Object} TwoFactorStatus
 * @property {string} uid                - Firebase UID
 * @property {boolean} firebaseMfa       - Whether Firebase MFA was used at sign-in
 * @property {string} firebaseMfaMethod  - Firebase MFA method ('totp', 'phone', 'none')
 * @property {boolean} totpEnrolled      - Whether custom TOTP is enrolled
 * @property {boolean} totpVerified      - Whether TOTP enrollment is confirmed
 * @property {boolean} sessionMfaVerified - Whether current session has MFA verified
 */

/**
 * @typedef {Object} Subscription
 * @property {string} id                 - Stripe subscription ID
 * @property {string} status             - 'active', 'trialing', 'past_due', 'canceled', 'incomplete'
 * @property {string} app                - App name (e.g., 'herbal-bridge')
 * @property {string} priceId            - Stripe price ID
 * @property {number} amount             - Price in cents
 * @property {string} currency           - Currency code (e.g., 'usd')
 * @property {string} interval           - 'month', 'year'
 * @property {number} currentPeriodEnd   - Unix timestamp
 * @property {boolean} cancelAtPeriodEnd - Whether subscription will cancel at period end
 * @property {number} created            - Unix timestamp
 */

/**
 * @typedef {Object} ReferralStats
 * @property {string|null} code          - Referral code
 * @property {string|null} link          - Full referral link
 * @property {number} totalReferred      - Total users referred
 * @property {number} totalEarnings      - Total earnings in dollars
 * @property {Array<{referredUid: string, app: string, date: string, reward: string}>} history
 */

/**
 * @typedef {Object} CognitiveProfile
 * @property {'basic'|'clear'|'standard'|'advanced'|'expert'} readingTier - Content complexity tier
 * @property {number} readingGrade         - Internal grade level (3-16), NEVER show to user
 * @property {string|null} mbtiType        - 4-letter MBTI type (e.g., 'INTJ') or null if unassessed
 * @property {Object|null} mbtiAxes       - Axis scores {EI, SN, TF, JP} (0-100)
 * @property {Object|null} big5           - Big 5 scores {O, C, E, A, N} (0-1 normalized)
 * @property {string} label               - Human-friendly label (e.g., 'Analytical Explorer')
 * @property {string|null} contentPreference - 'analytical'|'experiential'|'structured'|'empathetic'|'exploratory'
 */

/**
 * @typedef {Object} VaultStatus
 * @property {boolean} walletLinked        - Whether a Solana wallet is linked
 * @property {boolean} onChainStored       - Whether PPI data is stored on-chain
 * @property {string|null} walletAddress   - Linked Solana wallet address
 * @property {string|null} storedAt        - ISO timestamp of last on-chain store
 * @property {number} vaultVersion         - Vault data version
 */

/**
 * @typedef {Object} CompositeRank
 * @property {string} compositeTier        - Rank tier: A1, A2, B1, B2, or C
 * @property {number} compositeScore       - Numeric score (0-100)
 * @property {string|null} trustRank       - Trust Nexus rank name
 * @property {number} trustScore           - Trust component (0-100)
 * @property {string} cognitiveLabel       - Cognitive bucket label
 * @property {number} cognitiveScore       - Cognitive component (0-100)
 * @property {number} meritScore           - Merit component (0-100)
 */

// ─── Singleton + React Hook ────────────────────────────────────────────

let _singletonPassport = null;

export function getPassport(options) {
  if (!_singletonPassport) {
    _singletonPassport = new TechEasyPassport(options);
  }
  return _singletonPassport;
}

/**
 * React hook template — copy into your app:
 *
 *   import { useState, useEffect } from 'react';
 *   import { getPassport } from './passport-sdk';
 *
 *   export function usePassport(options) {
 *     const [user, setUser] = useState(null);
 *     const [loading, setLoading] = useState(true);
 *     const [needsProfile, setNeedsProfile] = useState(false);
 *     const [needs2FA, setNeeds2FA] = useState(false);
 *     const [subscriptions, setSubscriptions] = useState([]);
 *     const passport = getPassport(options);
 *
 *     useEffect(() => {
 *       // Set up profile gate
 *       passport.requireProfile({
 *         checkProfile: async (uid) => {
 *           const snap = await getDoc(doc(db, 'users', uid));
 *           return snap.exists();
 *         },
 *         onMissingProfile: () => setNeedsProfile(true),
 *       });
 *
 *       // Set up 2FA gate
 *       passport.on2FARequired(() => setNeeds2FA(true));
 *
 *       // Check session
 *       passport.check().then((u) => {
 *         if (u) {
 *           // Load subscriptions after auth check
 *           passport.getSubscriptions()
 *             .then(s => setSubscriptions(s.subscriptions || []))
 *             .catch(() => {});
 *           // Track referral if present
 *           passport.trackReferral().catch(() => {});
 *         }
 *       }).finally(() => setLoading(false));
 *       const unsub = passport.onAuthStateChanged(setUser);
 *       return unsub;
 *     }, []);
 *
 *     return { user, loading, needsProfile, needs2FA, subscriptions, passport };
 *   }
 *
 *   // In your App.tsx:
 *   function App() {
 *     const { user, loading, needsProfile, needs2FA, subscriptions, passport } = usePassport();
 *     if (loading) return <Spinner />;
 *     if (!user) return <LoginPage onLogin={() => passport.redirectToAuth('login')}
 *                                  onRegister={() => passport.redirectToAuth('register')} />;
 *     if (needsProfile) return <ProfileSetupModal user={user} />;
 *     if (needs2FA) return <TwoFactorPrompt passport={passport} />;
 *     const isPremium = subscriptions.some(s => s.app === 'my-app' && s.status === 'active');
 *     return <Dashboard user={user} isPremium={isPremium} passport={passport} />;
 *   }
 */
export function usePassport() {
  throw new Error(
    '[Passport] usePassport() cannot be called directly from the SDK. ' +
    'Copy the hook template from passport-sdk.js into your React app. ' +
    'See the comments above this function for the implementation.'
  );
}
