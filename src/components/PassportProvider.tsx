"use client";
import { useState } from 'react';
import { usePassport } from '@/lib/usePassport';
import { TwoFactorPrompt } from './TwoFactorPrompt';

export function PassportProvider({ children }: { children: React.ReactNode }) {
  const [verified, setVerified] = useState(false);
  const { needs2FA, passport } = usePassport({ require2FA: true });

  if (needs2FA && !verified) {
    return <TwoFactorPrompt passport={passport} onVerified={() => setVerified(true)} />;
  }

  return <>{children}</>;
}
