'use client';

import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged, signOut as firebaseSignOut, User } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { auth } from '@/lib/firebase/config';
import { useGuestMode } from './useGuestMode';
import { upsertPublicUserProfile } from '@/lib/firebase/friendsService';

const PUBLIC_SESSION_STORAGE_KEY = 'tsudoi.publicSessionUid';

export type AppUser = Pick<User, 'uid' | 'displayName' | 'email' | 'photoURL'> & {
  isAnonymous: boolean;
};

export function isPublicSessionUser(user: AppUser | null | undefined): boolean {
  return !!user?.isAnonymous && user.uid.startsWith('public_');
}

function createPublicSessionUser(uid: string): AppUser {
  return {
    uid,
    displayName: 'Public Organizer',
    email: null,
    photoURL: null,
    isAnonymous: true,
  };
}

interface AuthContextValue {
  user: AppUser | null;
  loading: boolean;
  isGuest: boolean;
  isPublicSession: boolean;
  signInAsGuest: () => Promise<void>;
  ensurePublicSession: () => Promise<AppUser>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<User | null | undefined>(undefined);
  const [publicSessionUser, setPublicSessionUser] = useState<AppUser | null>(null);
  const { isGuest, setIsGuest } = useGuestMode();
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        // A real Firebase user supersedes guest mode and public session mode.
        setIsGuest(false);
        setFirebaseUser(firebaseUser);
        setPublicSessionUser(null);
        if (!firebaseUser.isAnonymous) {
          void upsertPublicUserProfile({
            uid: firebaseUser.uid,
            displayName: firebaseUser.displayName,
            email: firebaseUser.email,
            photoURL: firebaseUser.photoURL,
          }).catch((error) => {
            console.error('Failed to sync public profile:', error);
          });
        }
      } else {
        setFirebaseUser(null);
      }
    });
    return unsubscribe;
  }, [setIsGuest]);

  const ensurePublicSession = useCallback(async (): Promise<AppUser> => {
    if (publicSessionUser) return publicSessionUser;

    const existingUid = window.localStorage.getItem(PUBLIC_SESSION_STORAGE_KEY);
    const uid = existingUid && existingUid.startsWith('public_')
      ? existingUid
      : `public_${crypto.randomUUID().replace(/-/g, '').slice(0, 20)}`;

    const nextUser = createPublicSessionUser(uid);
    window.localStorage.setItem(PUBLIC_SESSION_STORAGE_KEY, uid);
    setPublicSessionUser(nextUser);
    return nextUser;
  }, [publicSessionUser]);

  const signInAsGuest = useCallback(async () => {
    try {
      await firebaseSignOut(auth);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown sign-out error';
      console.error('Error clearing auth before guest mode:', message);
    }
    setIsGuest(true);
    router.push('/calendar');
  }, [router, setIsGuest]);

  const signOut = useCallback(async () => {
    const wasPublicSession = !!publicSessionUser;
    try {
      await firebaseSignOut(auth);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown sign-out error';
      console.error('Error signing out:', message);
      throw err instanceof Error ? err : new Error(message);
    }
    setIsGuest(false);
    if (wasPublicSession) {
      window.localStorage.removeItem(PUBLIC_SESSION_STORAGE_KEY);
      setPublicSessionUser(null);
    }
    router.push(wasPublicSession ? '/' : '/sign-in');
  }, [publicSessionUser, router, setIsGuest]);

  const user = useMemo(() => publicSessionUser ?? (firebaseUser && !firebaseUser.isAnonymous
    ? {
        uid: firebaseUser.uid,
        displayName: firebaseUser.displayName,
        email: firebaseUser.email,
        photoURL: firebaseUser.photoURL,
        isAnonymous: false,
      }
    : firebaseUser
      ? {
          uid: firebaseUser.uid,
          displayName: firebaseUser.displayName,
          email: firebaseUser.email,
          photoURL: firebaseUser.photoURL,
          isAnonymous: true,
        }
      : null), [firebaseUser, publicSessionUser]);

  const value: AuthContextValue = {
    user,
    loading: firebaseUser === undefined,
    isGuest,
    isPublicSession: !!publicSessionUser,
    signInAsGuest,
    ensurePublicSession,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
