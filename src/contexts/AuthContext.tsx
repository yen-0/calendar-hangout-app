'use client'; // This marks the component as a Client Component

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, onAuthStateChanged, signOut as firebaseSignOut } from 'firebase/auth';
import { auth } from '@/lib/firebase/config'; // Your Firebase auth instance
import { useRouter } from 'next/navigation';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isGuest: boolean;
  signInAsGuest: () => void;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isGuest, setIsGuest] = useState(false);
  const router = useRouter();

  useEffect(() => {
    // Check for guest status from localStorage
    const guestStatus = localStorage.getItem('isGuest') === 'true';
    setIsGuest(guestStatus);
    if (guestStatus) {
      setUser(null); // Ensure no Firebase user if guest
    }

    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
        setIsGuest(false); // If a user logs in, they are no longer a guest
        localStorage.removeItem('isGuest');
      } else if (!guestStatus) { // Only set user to null if not in guest mode
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const signInAsGuest = () => {
    setUser(null); // No Firebase user for guests
    setIsGuest(true);
    localStorage.setItem('isGuest', 'true');
    setLoading(false);
    router.push('/calendar'); // Or your main app page
  };

  const signOut = async () => {
    setLoading(true);
    try {
      await firebaseSignOut(auth);
      setUser(null);
      setIsGuest(false);
      localStorage.removeItem('isGuest');
      router.push('/sign-in');
    } catch (error) {
      console.error("Error signing out: ", error);
      // Handle sign-out error appropriately
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, isGuest, signInAsGuest, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};