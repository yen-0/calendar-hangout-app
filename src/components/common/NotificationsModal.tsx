'use client';

import React, { useState, useEffect } from 'react';
import Modal from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase/config';
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  doc,
  updateDoc,
  Timestamp,
  writeBatch,
} from 'firebase/firestore';
import { UserNotification, UserNotificationClient } from '@/types/notifications';
import { CalendarEventWithHangoutId } from '@/types/calendar';
import { addCalendarItem } from '@/lib/firebase/firestoreService';
import { format } from 'date-fns';
import { CalendarIcon } from '@heroicons/react/24/outline';
import Link from 'next/link';
import { showSuccessToast, showErrorToast } from '@/lib/toasts';
import { useLanguage } from '@/hooks/useLanguage';
import { acceptFriendRequest, declineFriendRequest } from '@/lib/firebase/friendsService';

interface NotificationsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const NotificationsModal: React.FC<NotificationsModalProps> = ({ isOpen, onClose }) => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<UserNotificationClient[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [processingNotificationId, setProcessingNotificationId] = useState<string | null>(null);
  const { t, language } = useLanguage();

  useEffect(() => {
    if (!user || !isOpen) {
      setNotifications([]);
      return;
    }

    setIsLoading(true);
    const userNotificationsRef = collection(db, `userNotifications/${user.uid}/notifications`);
    const q = query(userNotificationsRef, orderBy('createdAt', 'desc'));

    const unsubscribe = onSnapshot(
      q,
      (querySnapshot) => {
        const fetchedNotifications: UserNotificationClient[] = [];
        querySnapshot.forEach((doc) => {
          const data = doc.data() as UserNotification;
          fetchedNotifications.push({
            ...data,
            id: doc.id,
            createdAt: (data.createdAt as Timestamp).toDate(),
            confirmedSlotStart: data.confirmedSlotStart ? (data.confirmedSlotStart as Timestamp).toDate() : undefined,
            confirmedSlotEnd: data.confirmedSlotEnd ? (data.confirmedSlotEnd as Timestamp).toDate() : undefined,
          });
        });
        setNotifications(fetchedNotifications);
        setIsLoading(false);
      },
      (error) => {
        console.error('Error fetching notifications:', error);
        showErrorToast(t.notifications.loadFailed);
        setIsLoading(false);
      },
    );

    return () => unsubscribe();
  }, [user, isOpen, t.notifications.loadFailed]);

  const handleMarkAsRead = async (notificationId: string) => {
    if (!user) return;
    const notificationRef = doc(db, `userNotifications/${user.uid}/notifications/${notificationId}`);
    try {
      await updateDoc(notificationRef, { isRead: true });
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const handleMarkAllAsRead = async () => {
    if (!user || notifications.filter((n) => !n.isRead).length === 0) return;
    const batch = writeBatch(db);
    notifications.forEach((notif) => {
      if (!notif.isRead) {
        const notifRef = doc(db, `userNotifications/${user.uid}/notifications`, notif.id);
        batch.update(notifRef, { isRead: true });
      }
    });
    try {
      await batch.commit();
      showSuccessToast(t.notifications.allRead);
    } catch (error) {
      console.error('Error marking all as read:', error);
      showErrorToast(t.notifications.failedMarkAllRead);
    }
  };

  const handleAddHangoutToCalendar = async (notification: UserNotificationClient) => {
    if (!user || !notification.confirmedSlotStart || !notification.confirmedSlotEnd || !notification.hangoutRequestName) {
      showErrorToast(t.notifications.missingDetails);
      return;
    }
    setProcessingNotificationId(notification.id);
    const newCalendarEventData: Omit<CalendarEventWithHangoutId, 'id'> = {
      title: `Hangout: ${notification.hangoutRequestName}`,
      start: notification.confirmedSlotStart,
      end: notification.confirmedSlotEnd,
      allDay: false,
      color: '#4CAF50',
      hangoutRequestId: notification.hangoutRequestId!,
    };

    try {
      await addCalendarItem(user.uid, newCalendarEventData);
      showSuccessToast(
        language === 'ja'
          ? `"${newCalendarEventData.title}" をカレンダーに追加しました！`
          : `"${newCalendarEventData.title}" added to your calendar!`,
      );
      if (!notification.isRead) {
        handleMarkAsRead(notification.id);
      }
    } catch (error) {
      console.error('Error adding hangout to calendar:', error);
      showErrorToast(t.notifications.addToCalendarFailed);
    } finally {
      setProcessingNotificationId(null);
    }
  };

  const handleAcceptFriendRequest = async (notification: UserNotificationClient) => {
    if (!notification.friendRequestId) return;
    try {
      await acceptFriendRequest(notification.friendRequestId);
      await handleMarkAsRead(notification.id);
      showSuccessToast(t.notifications.friendAccepted);
    } catch (error) {
      console.error('Error accepting friend request:', error);
      showErrorToast(t.notifications.friendActionFailed);
    }
  };

  const handleDeclineFriendRequest = async (notification: UserNotificationClient) => {
    if (!notification.friendRequestId) return;
    try {
      await declineFriendRequest(notification.friendRequestId);
      await handleMarkAsRead(notification.id);
      showSuccessToast(t.notifications.friendDeclined);
    } catch (error) {
      console.error('Error declining friend request:', error);
      showErrorToast(t.notifications.friendActionFailed);
    }
  };

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`${t.notifications.title}${unreadCount > 0 ? ` (${unreadCount} ${t.notifications.unread})` : ''}`} size="md">
      <div className="max-h-[70vh] overflow-y-auto pr-2">
        {isLoading ? (
          <p className="py-4 text-center text-gray-500">{t.notifications.loading}</p>
        ) : notifications.length === 0 ? (
          <p className="py-10 text-center text-gray-500">{t.notifications.none}</p>
        ) : (
          <div className="space-y-3">
            {notifications.filter((n) => !n.isRead).length > 0 && (
              <div className="mb-3 text-right">
                <Button variant="link" size="sm" onClick={handleMarkAllAsRead} className="text-xs">
                  {t.notifications.markAllRead}
                </Button>
              </div>
            )}
            {notifications.map((notif) => (
              <div
                key={notif.id}
                className={`rounded-lg border p-3 ${notif.isRead ? 'border-gray-200 bg-gray-50' : 'border-blue-300 bg-blue-50 shadow-sm'}`}
              >
                <div className="flex items-start justify-between">
                  <p className={`text-sm ${notif.isRead ? 'text-gray-700' : 'font-medium text-blue-800'}`}>{notif.message}</p>
                  {!notif.isRead && (
                    <Button variant="ghost" size="sm" className="h-auto p-1 text-xs" onClick={() => handleMarkAsRead(notif.id)}>
                      {t.notifications.markRead}
                    </Button>
                  )}
                </div>
                <p className="mt-1 text-xs text-gray-400">
                  {format(notif.createdAt, 'MMM d, yyyy, hh:mm a')}
                </p>
                {notif.type === 'hangout_invitation' && notif.confirmedSlotStart && (
                  <div className="mt-2 border-t border-gray-200 pt-2">
                    <div className="flex items-center justify-between">
                      <Link href={`/hangouts/reply/${notif.hangoutRequestId}`} className="text-xs text-blue-600 hover:underline" onClick={onClose}>
                        {t.notifications.confirmedHangout}
                      </Link>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleAddHangoutToCalendar(notif)}
                        isLoading={processingNotificationId === notif.id}
                        disabled={processingNotificationId === notif.id}
                        className="bg-green-500 text-white hover:bg-green-600 text-xs"
                      >
                        <CalendarIcon className="mr-1.5 h-4 w-4" />
                        {t.notifications.addToCalendar}
                      </Button>
                    </div>
                  </div>
                )}
                {notif.type === 'friend_request' && (
                  <div className="mt-2 border-t border-gray-200 pt-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <Link
                        href="/friends"
                        className="text-xs text-blue-600 hover:underline"
                        onClick={onClose}
                      >
                        {t.notifications.openFriends}
                      </Link>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-xs"
                          onClick={() => void handleDeclineFriendRequest(notif)}
                        >
                          {t.notifications.declineFriend}
                        </Button>
                        <Button
                          size="sm"
                          className="text-xs"
                          onClick={() => void handleAcceptFriendRequest(notif)}
                        >
                          {t.notifications.acceptFriend}
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
};

export default NotificationsModal;
