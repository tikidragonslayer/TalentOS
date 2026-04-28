/**
 * @copyright Copyright (C) 2024-2026 The TalentOS Authors. AGPL-3.0
 * @fileOverview Real-time proctoring system for skill verification integrity.
 * Monitors tab focus, paste events, keystroke biometrics, mouse movement,
 * idle time, window resize, DevTools detection, and reCAPTCHA v3 scores.
 * Enhances the existing Humanity Score system with continuous monitoring
 * during the interview session.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ProctoringSession {
  startTime: number;
  tabBlurCount: number;
  tabBlurDurations: number[];
  pasteCount: number;
  keystrokeTimings: number[];       // inter-key intervals (ms)
  mouseMovements: number;
  idleTime: number;                 // total ms with no input
  suspiciousFlags: string[];
  recaptchaScore: number;           // 0-1 from reCAPTCHA v3
  windowResizeCount: number;
  windowTooSmall: boolean;
  devToolsDetected: boolean;
  lastInputTime: number;
  _blurStart: number | null;
  _idleTimer: ReturnType<typeof setInterval> | null;
  _listeners: Array<{ target: EventTarget; event: string; handler: EventListener }>;
  _devtoolsChecker: ReturnType<typeof setInterval> | null;
}

export interface ProctoringReport {
  score: number;                    // 0-100
  verdict: 'pass' | 'warning' | 'fail';
  flags: string[];
  breakdown: {
    tabBlurPenalty: number;
    pastePenalty: number;
    keystrokePenalty: number;
    mousePenalty: number;
    idlePenalty: number;
    recaptchaPenalty: number;
    devtoolsPenalty: number;
    windowPenalty: number;
  };
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TAB_BLUR_THRESHOLD = 3;
const TAB_BLUR_LONG_DURATION_MS = 30_000;
const PASTE_THRESHOLD = 2;
const KEYSTROKE_CV_THRESHOLD = 0.1;
const IDLE_THRESHOLD_MS = 120_000;
const IDLE_CHECK_INTERVAL_MS = 5_000;
const WINDOW_MIN_WIDTH = 500;
const WINDOW_MIN_HEIGHT = 400;
const DEVTOOLS_CHECK_INTERVAL_MS = 3_000;

// ---------------------------------------------------------------------------
// Start / Stop
// ---------------------------------------------------------------------------

export function startProctoring(recaptchaScore: number = 0): ProctoringSession {
  const session: ProctoringSession = {
    startTime: Date.now(),
    tabBlurCount: 0,
    tabBlurDurations: [],
    pasteCount: 0,
    keystrokeTimings: [],
    mouseMovements: 0,
    idleTime: 0,
    suspiciousFlags: [],
    recaptchaScore,
    windowResizeCount: 0,
    windowTooSmall: false,
    devToolsDetected: false,
    lastInputTime: Date.now(),
    _blurStart: null,
    _idleTimer: null,
    _listeners: [],
    _devtoolsChecker: null,
  };

  if (typeof window === 'undefined') return session;

  // --- Tab blur / focus ---
  const onVisibilityChange = () => {
    if (document.hidden) {
      session._blurStart = Date.now();
      session.tabBlurCount++;
    } else if (session._blurStart) {
      session.tabBlurDurations.push(Date.now() - session._blurStart);
      session._blurStart = null;
    }
  };
  addListener(session, document, 'visibilitychange', onVisibilityChange);

  // --- Paste detection ---
  const onPaste = () => {
    session.pasteCount++;
    session.lastInputTime = Date.now();
  };
  addListener(session, document, 'paste', onPaste as EventListener);

  // --- Keystroke biometrics ---
  let lastKeystrokeTime = 0;
  const onKeyDown = () => {
    const now = Date.now();
    session.lastInputTime = now;
    if (lastKeystrokeTime > 0) {
      session.keystrokeTimings.push(now - lastKeystrokeTime);
    }
    lastKeystrokeTime = now;
  };
  addListener(session, document, 'keydown', onKeyDown as EventListener);

  // --- Mouse movement ---
  const onMouseMove = () => {
    session.mouseMovements++;
    session.lastInputTime = Date.now();
  };
  addListener(session, document, 'mousemove', onMouseMove as EventListener);

  // --- Window resize ---
  const onResize = () => {
    session.windowResizeCount++;
    if (window.innerWidth < WINDOW_MIN_WIDTH || window.innerHeight < WINDOW_MIN_HEIGHT) {
      session.windowTooSmall = true;
      if (!session.suspiciousFlags.includes('window_too_small')) {
        session.suspiciousFlags.push('window_too_small');
      }
    }
  };
  addListener(session, window, 'resize', onResize as EventListener);

  // --- Idle detection ---
  session._idleTimer = setInterval(() => {
    const idleSinceLastInput = Date.now() - session.lastInputTime;
    if (idleSinceLastInput > IDLE_CHECK_INTERVAL_MS) {
      session.idleTime += IDLE_CHECK_INTERVAL_MS;
    }
  }, IDLE_CHECK_INTERVAL_MS);

  // --- DevTools detection (heuristic) ---
  session._devtoolsChecker = setInterval(() => {
    const threshold = 160;
    if (
      window.outerWidth - window.innerWidth > threshold ||
      window.outerHeight - window.innerHeight > threshold
    ) {
      if (!session.devToolsDetected) {
        session.devToolsDetected = true;
        session.suspiciousFlags.push('devtools_detected');
      }
    }
  }, DEVTOOLS_CHECK_INTERVAL_MS);

  return session;
}

export function stopProctoring(session: ProctoringSession): ProctoringReport {
  // Close any open blur
  if (session._blurStart) {
    session.tabBlurDurations.push(Date.now() - session._blurStart);
    session._blurStart = null;
  }

  // Clean up listeners
  for (const { target, event, handler } of session._listeners) {
    target.removeEventListener(event, handler);
  }
  session._listeners = [];

  // Clear timers
  if (session._idleTimer) clearInterval(session._idleTimer);
  if (session._devtoolsChecker) clearInterval(session._devtoolsChecker);

  return buildReport(session);
}

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

export function getProctoringScore(session: ProctoringSession): number {
  return buildReport(session).score;
}

function buildReport(session: ProctoringSession): ProctoringReport {
  const flags: string[] = [...session.suspiciousFlags];
  let score = 100;

  // Tab blur penalties
  let tabBlurPenalty = 0;
  if (session.tabBlurCount > TAB_BLUR_THRESHOLD) {
    tabBlurPenalty += 20;
    flags.push(`tab_blur_count_${session.tabBlurCount}`);
  }
  if (session.tabBlurDurations.some(d => d > TAB_BLUR_LONG_DURATION_MS)) {
    tabBlurPenalty += 15;
    flags.push('tab_blur_long_duration');
  }

  // Paste penalties
  let pastePenalty = 0;
  if (session.pasteCount > PASTE_THRESHOLD) {
    pastePenalty = 15;
    flags.push(`paste_count_${session.pasteCount}`);
  }

  // Keystroke biometrics — coefficient of variation
  let keystrokePenalty = 0;
  if (session.keystrokeTimings.length > 10) {
    const mean = session.keystrokeTimings.reduce((a, b) => a + b, 0) / session.keystrokeTimings.length;
    const stdDev = Math.sqrt(
      session.keystrokeTimings.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / session.keystrokeTimings.length
    );
    const cv = mean > 0 ? stdDev / mean : 0;
    if (cv < KEYSTROKE_CV_THRESHOLD) {
      keystrokePenalty = 25;
      flags.push(`keystroke_cv_${cv.toFixed(3)}`);
    }
  }

  // Mouse movement — zero = likely automation
  let mousePenalty = 0;
  const elapsedMinutes = (Date.now() - session.startTime) / 60_000;
  if (session.mouseMovements === 0 && elapsedMinutes > 1) {
    mousePenalty = 20;
    flags.push('no_mouse_movement');
  }

  // Idle time
  let idlePenalty = 0;
  if (session.idleTime > IDLE_THRESHOLD_MS) {
    idlePenalty = 10;
    flags.push(`idle_time_${Math.round(session.idleTime / 1000)}s`);
  }

  // reCAPTCHA score
  let recaptchaPenalty = 0;
  if (session.recaptchaScore > 0 && session.recaptchaScore < 0.5) {
    recaptchaPenalty = 30;
    flags.push(`recaptcha_score_${session.recaptchaScore.toFixed(2)}`);
  }

  // DevTools
  let devtoolsPenalty = 0;
  if (session.devToolsDetected) {
    devtoolsPenalty = 15;
  }

  // Window too small
  let windowPenalty = 0;
  if (session.windowTooSmall) {
    windowPenalty = 5;
  }

  score -= tabBlurPenalty + pastePenalty + keystrokePenalty + mousePenalty +
           idlePenalty + recaptchaPenalty + devtoolsPenalty + windowPenalty;
  score = Math.max(0, Math.min(100, score));

  let verdict: 'pass' | 'warning' | 'fail';
  if (score >= 70) verdict = 'pass';
  else if (score >= 50) verdict = 'warning';
  else verdict = 'fail';

  return {
    score,
    verdict,
    flags,
    breakdown: {
      tabBlurPenalty,
      pastePenalty,
      keystrokePenalty,
      mousePenalty,
      idlePenalty,
      recaptchaPenalty,
      devtoolsPenalty,
      windowPenalty,
    },
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function addListener(
  session: ProctoringSession,
  target: EventTarget,
  event: string,
  handler: EventListener
) {
  target.addEventListener(event, handler);
  session._listeners.push({ target, event, handler });
}
