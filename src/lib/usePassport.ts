import { useState, useEffect, useCallback } from 'react';
import { TechEasyPassport, getPassport } from './passport-sdk';

interface PassportUser {
  uid: string;
  email: string;
  name: string;
  picture: string;
  provider: string;
  mfaVerified: boolean;
  mfaMethod: string;
  totpEnrolled: boolean;
}

interface UsePassportReturn {
  user: PassportUser | null;
  loading: boolean;
  needs2FA: boolean;
  passport: TechEasyPassport;
  login: () => void;
  register: () => void;
  logout: () => Promise<void>;
}

export function usePassport(options?: { require2FA?: boolean }): UsePassportReturn {
  const [user, setUser] = useState<PassportUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [needs2FA, setNeeds2FA] = useState(false);
  const passport = getPassport({ require2FA: options?.require2FA });

  useEffect(() => {
    passport.on2FARequired(() => setNeeds2FA(true));

    passport.check()
      .then((u: PassportUser | null) => {
        if (u) {
          passport.trackReferral().catch(() => {});
        }
      })
      .finally(() => setLoading(false));

    const unsub = passport.onAuthStateChanged(setUser);
    return unsub;
  }, []);

  const login = useCallback(() => passport.redirectToAuth('login'), [passport]);
  const register = useCallback(() => passport.redirectToAuth('register'), [passport]);
  const logout = useCallback(() => passport.logout(), [passport]);

  return { user, loading, needs2FA, passport, login, register, logout };
}
