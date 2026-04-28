// src/app/login/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useUser } from '@/contexts/user-context';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { GoogleSignInButton } from '@/components/auth/google-sign-in';
import { useAuth } from '@/firebase';
import { EmailAuthProvider, GoogleAuthProvider, sendPasswordResetEmail } from 'firebase/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { authUser, setRole, role } = useUser();
  const auth = useAuth();
  const { toast } = useToast();

  const [showResetForm, setShowResetForm] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetLoading, setResetLoading] = useState(false);

  const intendedRole = searchParams.get('role') as 'candidate' | 'employer' | null;

  useEffect(() => {
    // If the user is authenticated and their role is determined, redirect to dashboard.
    if (authUser && role) {
      router.push('/dashboard');
    } else if (authUser && !role && intendedRole) {
      // User is logged in but role is not yet set in context (might be a fresh login).
      // The role will be picked up from the profile document by the UserProvider.
      // We set it here as a fallback and to ensure redirection happens.
      setRole(intendedRole);
      router.push('/dashboard');
    }
  }, [authUser, role, intendedRole, setRole, router]);

  const handleLoginSuccess = () => {
    if (intendedRole) {
      localStorage.setItem('userRole', intendedRole);
      setRole(intendedRole);
    }
  };

  const handleResetPassword = async () => {
    if (!resetEmail) {
      toast({ title: "Email required", description: "Please enter your email address.", variant: "destructive" });
      return;
    }
    if (!auth) return;
    setResetLoading(true);
    try {
      await sendPasswordResetEmail(auth, resetEmail);
      toast({ title: "Check your inbox", description: "If an account exists for that email, a password reset link has been sent." });
      setShowResetForm(false);
      setResetEmail('');
    } catch {
      // Don't reveal whether the email exists
      toast({ title: "Check your inbox", description: "If an account exists for that email, a password reset link has been sent." });
      setShowResetForm(false);
      setResetEmail('');
    } finally {
      setResetLoading(false);
    }
  };

  if (!auth) {
    return (
      <div className="container mx-auto py-12">
        <Card className="max-w-md mx-auto">
          <CardHeader>
            <CardTitle className="text-destructive">Authentication Error</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              The authentication service could not be loaded. This is likely due to a missing or invalid Firebase configuration in your environment variables.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-12 flex items-center justify-center min-h-[calc(100vh-8rem)]">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">
            {intendedRole ? `Join as ${intendedRole === 'candidate' ? 'Talent' : 'a Builder'}` : 'Sign In'}
          </CardTitle>
          <CardDescription>
            Sign in or create an account to continue
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <GoogleSignInButton auth={auth} onSuccess={handleLoginSuccess} />

          {!showResetForm ? (
            <div className="text-center">
              <button
                type="button"
                className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                onClick={() => setShowResetForm(true)}
              >
                Forgot password?
              </button>
            </div>
          ) : (
            <div className="space-y-3 rounded-md border p-4">
              <p className="text-sm font-medium">Reset your password</p>
              <Input
                type="email"
                placeholder="you@example.com"
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
                disabled={resetLoading}
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={handleResetPassword}
                  disabled={resetLoading}
                  className="flex-1"
                >
                  {resetLoading ? 'Sending...' : 'Send reset link'}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => { setShowResetForm(false); setResetEmail(''); }}
                  disabled={resetLoading}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
