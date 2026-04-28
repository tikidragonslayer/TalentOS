import { useState } from 'react';
import type { TechEasyPassport } from '../lib/passport-sdk';

interface TwoFactorPromptProps {
  passport: TechEasyPassport;
  onVerified: () => void;
  onCancel?: () => void;
}

export function TwoFactorPrompt({ passport, onVerified, onCancel }: TwoFactorPromptProps) {
  const [step, setStep] = useState<'check' | 'enroll' | 'verify'>('check');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [qrUri, setQrUri] = useState('');
  const [secret, setSecret] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[]>([]);

  // Check enrollment status on mount
  useState(() => {
    passport.get2FAStatus().then((status) => {
      if (status.totpVerified && status.sessionMfaVerified) {
        onVerified();
      } else if (status.totpEnrolled && status.totpVerified) {
        setStep('verify');
      } else {
        setStep('enroll');
      }
    }).catch(() => setStep('enroll'));
  });

  async function handleEnroll() {
    setLoading(true);
    setError('');
    try {
      const { otpauthUri, secret: s } = await passport.enroll2FA();
      setQrUri(otpauthUri);
      setSecret(s);
      setStep('verify');
    } catch (err: any) {
      setError(err.message || 'Enrollment failed');
    } finally {
      setLoading(false);
    }
  }

  async function handleVerify() {
    if (!/^\d{6}$/.test(code)) {
      setError('Enter a 6-digit code');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const result = await passport.verify2FA(code) as { success: boolean; mfaVerified: boolean; message: string; backupCodes?: string[] };
      if (result.backupCodes) {
        setBackupCodes(result.backupCodes);
      } else {
        onVerified();
      }
    } catch (err: any) {
      setError(err.message || 'Invalid code');
    } finally {
      setLoading(false);
    }
  }

  function handleBackupDone() {
    onVerified();
  }

  // Backup codes screen
  if (backupCodes.length > 0) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
        <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl dark:bg-gray-900">
          <h2 className="mb-2 text-xl font-bold text-gray-900 dark:text-white">
            Save Your Backup Codes
          </h2>
          <p className="mb-4 text-sm text-gray-600 dark:text-gray-400">
            Store these codes somewhere safe. Each code can only be used once. You won't see them again.
          </p>
          <div className="mb-4 grid grid-cols-2 gap-2 rounded-lg bg-gray-100 p-4 font-mono text-sm dark:bg-gray-800">
            {backupCodes.map((c, i) => (
              <div key={i} className="text-gray-900 dark:text-gray-100">{c}</div>
            ))}
          </div>
          <button
            onClick={() => {
              navigator.clipboard.writeText(backupCodes.join('\n')).catch(() => {});
            }}
            className="mb-3 w-full rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            Copy to Clipboard
          </button>
          <button
            onClick={handleBackupDone}
            className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700"
          >
            I've Saved My Codes
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl dark:bg-gray-900">
        <h2 className="mb-2 text-xl font-bold text-gray-900 dark:text-white">
          {step === 'enroll' ? 'Set Up Two-Factor Authentication' : 'Two-Factor Authentication'}
        </h2>

        {step === 'enroll' && !qrUri && (
          <>
            <p className="mb-4 text-sm text-gray-600 dark:text-gray-400">
              Protect your account with an authenticator app like Google Authenticator or Authy.
            </p>
            <button
              onClick={handleEnroll}
              disabled={loading}
              className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Setting up...' : 'Enable 2FA'}
            </button>
            {onCancel && (
              <button
                onClick={onCancel}
                className="mt-2 w-full rounded-lg px-4 py-2 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400"
              >
                Skip for now
              </button>
            )}
          </>
        )}

        {step === 'verify' && (
          <>
            {qrUri && (
              <div className="mb-4">
                <p className="mb-2 text-sm text-gray-600 dark:text-gray-400">
                  Scan this QR code with your authenticator app:
                </p>
                <div className="flex justify-center rounded-lg bg-white p-4">
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrUri)}`}
                    alt="2FA QR Code"
                    width={200}
                    height={200}
                  />
                </div>
                {secret && (
                  <p className="mt-2 text-center text-xs text-gray-500 dark:text-gray-400">
                    Manual entry: <code className="rounded bg-gray-100 px-1 font-mono dark:bg-gray-800">{secret}</code>
                  </p>
                )}
              </div>
            )}

            {!qrUri && (
              <p className="mb-4 text-sm text-gray-600 dark:text-gray-400">
                Enter the 6-digit code from your authenticator app.
              </p>
            )}

            <div className="mb-4">
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                placeholder="000000"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                onKeyDown={(e) => e.key === 'Enter' && handleVerify()}
                className="w-full rounded-lg border border-gray-300 px-4 py-3 text-center font-mono text-2xl tracking-widest focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                autoFocus
              />
            </div>

            {error && (
              <p className="mb-3 text-center text-sm text-red-600 dark:text-red-400">{error}</p>
            )}

            <button
              onClick={handleVerify}
              disabled={loading || code.length !== 6}
              className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Verifying...' : 'Verify Code'}
            </button>

            {onCancel && (
              <button
                onClick={onCancel}
                className="mt-2 w-full rounded-lg px-4 py-2 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400"
              >
                Cancel
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
