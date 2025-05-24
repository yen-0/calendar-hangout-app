'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, ReactNode } from 'react';

export default function AuthLayout({ children }: { children: ReactNode }) {
  const { user, loading, isGuest } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && (user || isGuest)) {
      router.replace('/calendar'); // Or your main app dashboard
    }
  }, [user, loading, isGuest, router]);

  if (loading || user || isGuest) {
    // Show a loading spinner or a blank page while checking auth state or redirecting
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p>Loading...</p> {/* Replace with a proper spinner component */}
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-100px)] bg-gradient-to-br from-slate-100 to-sky-100">
      <div className="w-full max-w-md p-8 space-y-6 bg-white rounded-xl shadow-2xl">
        {children}
      </div>
    </div>
  );
}