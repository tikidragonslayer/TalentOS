import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import { Toaster } from "@/components/ui/toaster";
import { UserProvider } from '@/contexts/user-context';
import { cn } from '@/lib/utils';
import { AppShell } from '@/components/layout/app-shell';
import { FirebaseClientProvider } from '@/firebase';
import { RecaptchaProvider } from '@/components/security/recaptcha-provider';
import { PassportProvider } from '@/components/PassportProvider';
import CookieConsent from '@/components/CookieConsent';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://example.com';

export const metadata: Metadata = {
  title: 'TalentOS — Anonymous, skills-first hiring',
  description:
    'Open-source anonymous-by-default talent matching with personality-pair compatibility, AI skill verification, and progressive reveal. AGPL-3.0.',
  metadataBase: new URL(SITE_URL),
  alternates: { canonical: '/' },
  openGraph: {
    title: 'TalentOS — Anonymous, skills-first hiring',
    description:
      'Open-source hiring platform that anonymizes candidates and employers, scores compatibility, and reveals identity progressively.',
    type: 'website',
    url: SITE_URL,
    siteName: 'TalentOS',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'TalentOS — Anonymous, skills-first hiring',
    description:
      'Open-source hiring platform that anonymizes candidates and employers, scores compatibility, and reveals identity progressively.',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={cn(
          'min-h-screen bg-background font-sans antialiased',
          geistSans.variable,
          geistMono.variable,
        )}
        suppressHydrationWarning
      >
        <FirebaseClientProvider>
          <UserProvider>
            <RecaptchaProvider>
              <AppShell>
                <PassportProvider>{children}</PassportProvider>
              </AppShell>
            </RecaptchaProvider>
          </UserProvider>
        </FirebaseClientProvider>
        <Toaster />
        <CookieConsent />
      </body>
    </html>
  );
}
