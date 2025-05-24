// src/app/(auth)/sign-in/page.tsx
'use client';

import { useState } from 'react';
import Link from 'next/link';
// import { useRouter } from 'next/navigation'; // Not strictly needed if AuthProvider handles redirect
import { signInWithEmailAndPassword, GoogleAuthProvider, signInWithPopup } from '@/lib/firebase';
import { auth } from '@/lib/firebase/config';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';

// Simple Google Icon (replace with a proper SVG or icon library)
const GoogleIcon = () => (
  <svg className="mr-2 h-4 w-4" aria-hidden="true" focusable="false" data-prefix="fab" data-icon="google" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 488 512">
    <path fill="currentColor" d="M488 261.8C488 403.3 381.5 512 244 512 110.3 512 0 401.7 0 260.4S109.4 8 243.1 8c69.3 0 125.3 27.1 170.8 69.9l-63.9 61.9C325 110.7 288.8 91.2 243.1 91.2c-69.3 0-125.3 55.7-125.3 124.2s56 124.2 125.3 124.2c78.3 0 110.9-33.4 114.8-52.1H243.1v-71.3h239.1c1.4 12.3 2.3 24.7 2.3 37.9z"></path>
  </svg>
);

export default function SignInPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  // const router = useRouter();
  const { signInAsGuest } = useAuth();

  const handleSignIn = async (e: React.FormEvent<HTMLFormElement>) => {
    // ... (same as before)
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err: any) {
      setError(err.message || "Failed to sign in. Check credentials.");
      console.error("Sign in error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError(null);
    setIsGoogleLoading(true);
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
      // AuthProvider's onAuthStateChanged will handle redirect
      // router.push('/calendar');
    } catch (err: any) {
      setError(err.message || "Failed to sign in with Google.");
      console.error("Google Sign in error:", err);
    } finally {
      setIsGoogleLoading(false);
    }
  };
  
  const handleGuestSignIn = () => {
    signInAsGuest();
  };


  return (
    <>
      <h2 className="text-3xl font-bold text-center text-gray-800">Sign In</h2>
      
      {/* Google Sign-In Button */}
      <div className="mt-6">
        <Button
          variant="outline"
          className="w-full border-slate-300 text-slate-700 hover:bg-slate-50"
          onClick={handleGoogleSignIn}
          isLoading={isGoogleLoading}
          disabled={isLoading || isGoogleLoading}
        >
          <GoogleIcon />
          Sign in with Google
        </Button>
      </div>

      <div className="my-6 flex items-center before:mt-0.5 before:flex-1 before:border-t before:border-neutral-300 after:mt-0.5 after:flex-1 after:border-t after:border-neutral-300">
        <p className="mx-4 mb-0 text-center font-semibold dark:text-neutral-200">Or</p>
      </div>

      <form onSubmit={handleSignIn} className="space-y-6">
        {/* ... (email and password fields remain the same) ... */}
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700">
            Email address
          </label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            disabled={isGoogleLoading}
          />
        </div>

        <div>
          <label htmlFor="password" className="block text-sm font-medium text-gray-700">
            Password
          </label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            disabled={isGoogleLoading}
          />
        </div>
        {error && <p className="text-sm text-red-600 text-center">{error}</p>}

        <div>
          <Button type="submit" className="w-full" isLoading={isLoading} disabled={isLoading || isGoogleLoading}>
            {isLoading ? 'Signing In...' : 'Sign In with Email'}
          </Button>
        </div>
      </form>
      
      {/* Guest Mode */}
      <div className="my-6 flex items-center before:mt-0.5 before:flex-1 before:border-t before:border-neutral-300 after:mt-0.5 after:flex-1 after:border-t after:border-neutral-300">
        <p className="mx-4 mb-0 text-center font-semibold dark:text-neutral-200">Or</p>
      </div>
      <div>
        <Button
          variant="outline"
          className="w-full border-slate-300 text-slate-700 hover:bg-slate-50"
          onClick={handleGuestSignIn}
          disabled={isLoading || isGoogleLoading}
        >
          Continue as Guest
        </Button>
      </div>

      <p className="mt-8 text-center text-sm text-gray-600">
        Not a member?{' '}
        <Link href="/sign-up" className="font-medium text-blue-600 hover:text-blue-500">
          Sign Up
        </Link>
      </p>
    </>
  );
}