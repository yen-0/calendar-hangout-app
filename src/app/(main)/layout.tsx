'use client';

import React, { useState, useEffect, useCallback } from 'react';
import AppHeader from '@/components/layout/AppHeader';
import NotificationsModal from '@/components/common/NotificationsModal';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';
import { useAuth } from '@/contexts/AuthContext';
import { usePathname, useRouter } from 'next/navigation';
import { db } from '@/lib/firebase/config';
import { collection, query, where, onSnapshot } from 'firebase/firestore';

export default function MainAppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, isGuest, isPublicSession } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  const [isNotificationsModalOpen, setIsNotificationsModalOpen] = useState(false);
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState(0);

  const openNotificationsModal = useCallback(() => {
    setIsNotificationsModalOpen(true);
  }, []);

  const closeNotificationsModal = useCallback(() => {
    setIsNotificationsModalOpen(false);
  }, []);

  useEffect(() => {
    if (!user || isGuest) {
      setUnreadNotificationsCount(0);
      return;
    }
    if (!db) {
      console.warn("Firestore db instance not available for notifications listener in MainAppLayout.");
      return;
    }

    const userNotificationsRef = collection(db, `userNotifications/${user.uid}/notifications`);
    const q = query(userNotificationsRef, where('isRead', '==', false));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setUnreadNotificationsCount(snapshot.size);
    }, (error) => {
      console.error("Error listening to unread notifications in MainAppLayout:", error);
    });

    return () => unsubscribe();
  }, [user, isGuest]);

  useEffect(() => {
    if (!isPublicSession) return;
    const isHangoutRoute = pathname.startsWith('/hangouts');
    if (!isHangoutRoute) {
      router.replace('/hangouts');
    }
  }, [isPublicSession, pathname, router]);

  const isPublicHangoutRoute = !isPublicSession || pathname.startsWith('/hangouts');

  return (
    <div className="flex flex-col min-h-screen">
      <AppHeader
        onOpenNotifications={openNotificationsModal}
        unreadNotificationsCount={unreadNotificationsCount}
      />
      <main className="flex-grow container mx-auto py-4 px-2 md:px-4">
        {isPublicHangoutRoute ? <ErrorBoundary>{children}</ErrorBoundary> : <div className="p-6 text-center text-sm text-gray-500">Loading…</div>}
      </main>
      {/* Shared footer could go here */}

      {user && !isGuest && (
          <NotificationsModal
            isOpen={isNotificationsModalOpen}
            onClose={closeNotificationsModal}
          />
      )}
    </div>
  );
}
