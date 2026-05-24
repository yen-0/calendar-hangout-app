'use client';

import { createContext, ReactNode, useCallback, useContext, useEffect, useReducer } from 'react';
import { onAuthStateChanged, signOut as firebaseSignOut, User } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { auth } from '@/lib/firebase/config';
import { useGuestMode } from './useGuestMode';

type AuthState =
  | { status: 'loading'; user: null }
  | { status: 'authenticated'; user: User }
  | { status: 'anonymous'; user: null };

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
      return { status: 'anonymous', user: null };
    case 'signedOut':
      return { status: 'anonymous', user: null };
    default:
      return state;
  }
}

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  isGuest: boolean;
  signInAsGuest: () => void;
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
        // A real Firebase user supersedes guest mode.
        setIsGuest(false);
        dispatch({ type: 'firebaseUser', user: firebaseUser });
      } else {
        dispatch({ type: 'firebaseNoUser' });
      }
    });
    return unsubscribe;
  }, [setIsGuest]);

  const signInAsGuest = useCallback(() => {
    setIsGuest(true);
    router.push('/calendar');
  }, [router, setIsGuest]);

  const signOut = useCallback(async () => {
    try {
      await firebaseSignOut(auth);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown sign-out error';
      console.error('Error signing out:', message);
      throw err instanceof Error ? err : new Error(message);
    }
    setIsGuest(false);
    dispatch({ type: 'signedOut' });
    router.push('/sign-in');
  }, [router, setIsGuest]);

  const value: AuthContextValue = {
    user: state.user,
    loading: state.status === 'loading',
    isGuest,
    signInAsGuest,
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
