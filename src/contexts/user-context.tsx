// src/contexts/user-context.tsx
'use client';

import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { onAuthStateChanged, signOut, type User as FirebaseUser } from 'firebase/auth';
import { useAuth, useDoc, useFirestore, useMemoFirebase, useCollection } from '@/firebase'; // Use the hook from our provider
import { doc } from 'firebase/firestore';
import { getPassport } from '@/lib/passport-sdk';
import type { UserProfile, EmployerProfile, Company } from '@/types';
/**
 * Optional admin override. Set NEXT_PUBLIC_TALENTOS_ADMIN_EMAILS to a
 * comma-separated list of emails that should always have premium access.
 * Useful for self-hosted deployments and local development. Leave empty
 * (default) for production multi-tenant deployments.
 */
function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const list = (process.env.NEXT_PUBLIC_TALENTOS_ADMIN_EMAILS ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return list.includes(email.toLowerCase());
}

type UserRole = 'candidate' | 'employer' | null;

interface AuthUser {
  id: string;
  email?: string | null;
}

interface UserContextType {
  authUser: AuthUser | null;
  profile: UserProfile | EmployerProfile | Company | null;
  userDoc: UserProfile | EmployerProfile | null; // Raw user document (for subscription fields)
  role: UserRole;
  isLoading: boolean;
  logout: () => Promise<void>;
  setRole: (role: UserRole) => void;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export function UserProvider({ children }: { children: ReactNode }) {
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [role, setRoleState] = useState<UserRole>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [loadingTimedOut, setLoadingTimedOut] = useState(false);

  const auth = useAuth();
  const firestore = useFirestore();

  // Safety timeout: if loading takes longer than 5 seconds, stop blocking the UI
  useEffect(() => {
    const timer = setTimeout(() => {
      setLoadingTimedOut(true);
    }, 5000);
    return () => clearTimeout(timer);
  }, []);

  const userProfileRef = useMemoFirebase(() => {
    if (!firestore || !authUser?.id) return null;
    return doc(firestore, `users/${authUser.id}`);
  }, [firestore, authUser?.id]);

  const { data: userDoc, isLoading: isProfileLoading } = useDoc<UserProfile | EmployerProfile>(userProfileRef);

  const companyRef = useMemoFirebase(() => {
    if (!firestore || !userDoc || userDoc.role !== 'employer' || !(userDoc as EmployerProfile).companyId) return null;
    return doc(firestore, `companies/${(userDoc as EmployerProfile).companyId}`);
  }, [firestore, userDoc]);

  const { data: companyDoc, isLoading: isCompanyLoading } = useDoc<Company>(companyRef);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser: FirebaseUser | null) => {
      if (firebaseUser) {
        setAuthUser({
          id: firebaseUser.uid,
          email: firebaseUser.email,
        });

        // Sync Firebase auth state to Passport cross-domain session
        try {
          const idToken = await firebaseUser.getIdToken();
          const passport = getPassport({});
          await passport.createSession(idToken);
        } catch (err) {
          console.warn('[Passport] Session creation failed:', err);
        }
      } else {
        setAuthUser(null);
        setRoleState(null);
        localStorage.removeItem('userRole');
      }
      setIsAuthLoading(false);
    });

    return () => unsubscribe();
  }, [auth]);

  useEffect(() => {
    if (userDoc) {
      setRoleState(userDoc.role);
      localStorage.setItem('userRole', userDoc.role);
    } else if (!isProfileLoading && authUser) {
      const storedRole = localStorage.getItem('userRole') as UserRole;
      if (storedRole) {
        setRoleState(storedRole);
      }
    }
  }, [userDoc, isProfileLoading, authUser]);

  const setRole = useCallback((newRole: UserRole) => {
    setRoleState(newRole);
    if (newRole) {
      localStorage.setItem('userRole', newRole);
    } else {
      localStorage.removeItem('userRole');
    }
  }, []);

  const logout = async () => {
    // Clear Passport cross-domain session first
    try {
      const passport = getPassport({});
      await passport.logout();
    } catch (err) {
      console.warn('[Passport] Logout failed:', err);
    }
    await signOut(auth);
    setAuthUser(null);
    setRoleState(null);
    localStorage.removeItem('userRole');
    sessionStorage.removeItem("tos-terms-agreed");
  };

  const isLoading = !loadingTimedOut && (isAuthLoading || isProfileLoading || (userDoc?.role === 'employer' && isCompanyLoading));

  const profile = role === 'employer' ? companyDoc : userDoc;

  // Optional admin override (env-driven; empty by default).
  const effectiveUserDoc = (() => {
    if (isAdminEmail(authUser?.email) && userDoc) {
      return { ...userDoc, isPremium: true, plan: userDoc.plan || 'enterprise' };
    }
    return userDoc ?? null;
  })();

  const value = { authUser, profile, userDoc: effectiveUserDoc, role, isLoading, logout, setRole };

  return (
    <UserContext.Provider value={value}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
}

export { useFirestore, useDoc, useCollection, useMemoFirebase };
