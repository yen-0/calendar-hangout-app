'use client';

import { createContext, ReactNode, useCallback, useContext, useEffect, useReducer } from 'react';
import { onAuthStateChanged, signInWithCustomToken, signOut as firebaseSignOut, User } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { auth } from '@/lib/firebase/config';
import { useGuestMode } from './useGuestMode';
import { upsertPublicUserProfile } from '@/lib/firebase/friendsService';

const PUBLIC_SESSION_UID_PREFIX = 'public_';

export function isPublicSessionUser(user: User | null | undefined): boolean {
  return !!user?.uid.startsWith(PUBLIC_SESSION_UID_PREFIX);
}

type AuthState =
  | { status: 'loading'; user: null }
  | { status: 'authenticated'; user: User }
  | { status: 'signedOut'; user: null };

type AuthAction =
  | { type: 'firebaseUser'; user: User }
  | { type: 'firebaseNoUser' }
  | { type: 'signedOut' };

const initialState: AuthState = { status: 'loading', user: null };

function reducer(state: AuthState, action: AuthAction): AuthState {
  switch (action.type) {
    case 'firebaseUser':
      return { status: 'authenticated', user: action.user };
    case 'firebaseNoUser':
      return { status: 'signedOut', user: null };
    case 'signedOut':
      return { status: 'signedOut', user: null };
    default:
      return state;
  }
}

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  isGuest: boolean;
  isPublicSession: boolean;
  signInAsGuest: () => Promise<void>;
  ensurePublicSession: () => Promise<User>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const { isGuest, setIsGuest } = useGuestMode();
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        // A real Firebase user supersedes guest mode. Anonymous users are
        // allowed, but they stay on the public hangout path instead of the
        // calendar guest path.
        setIsGuest(false);
        dispatch({ type: 'firebaseUser', user: firebaseUser });
        if (!isPublicSessionUser(firebaseUser)) {
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
        dispatch({ type: 'firebaseNoUser' });
      }
    });
    return unsubscribe;
  }, [setIsGuest]);

  const ensurePublicSession = useCallback(async (): Promise<User> => {
    const currentUser = auth.currentUser;
    if (currentUser) return currentUser;
    const response = await fetch('/api/auth/public-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!response.ok) {
      const errorBody = await response.text().catch(() => '');
      throw new Error(errorBody || 'Failed to start public session.');
    }
    const payload = (await response.json()) as { token?: string };
    if (!payload.token) {
      throw new Error('Public session token missing from server response.');
    }
    const credential = await signInWithCustomToken(auth, payload.token);
    return credential.user;
  }, []);

  const signInAsGuest = useCallback(async () => {
    try {
      await firebaseSignOut(auth);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown sign-out error';
      console.error('Error clearing auth before guest mode:', message);
    }
    setIsGuest(true);
    dispatch({ type: 'signedOut' });
    router.push('/calendar');
  }, [router, setIsGuest]);

  const signOut = useCallback(async () => {
    const wasPublicSession = isPublicSessionUser(auth.currentUser);
    try {
      await firebaseSignOut(auth);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown sign-out error';
      console.error('Error signing out:', message);
      throw err instanceof Error ? err : new Error(message);
    }
    setIsGuest(false);
    dispatch({ type: 'signedOut' });
    router.push(wasPublicSession ? '/' : '/sign-in');
  }, [router, setIsGuest]);

  const value: AuthContextValue = {
    user: state.user,
    loading: state.status === 'loading',
    isGuest,
    isPublicSession: isPublicSessionUser(state.user),
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
