
// src/components/common/NotificationsModal.tsx
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Modal from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase/config';
import { collection, query, where, orderBy, onSnapshot, doc, updateDoc, Timestamp, writeBatch } from 'firebase/firestore';
import { UserNotification, UserNotificationClient } from '@/types/notifications';
import { CalendarEvent } from '@/types/events';
import { addCalendarItem } from '@/lib/firebase/firestoreService'; // For adding event to own calendar
import { format } from 'date-fns';
import { BellIcon, CalendarIcon, CheckCircleIcon } from '@heroicons/react/24/outline'; // Or your icons
import Link from 'next/link';
import { showSuccessToast, showErrorToast } from '@/lib/toasts';

interface NotificationsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const NotificationsModal: React.FC<NotificationsModalProps> = ({ isOpen, onClose }) => {
    const { user } = useAuth();
    const [notifications, setNotifications] = useState<UserNotificationClient[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [processingNotificationId, setProcessingNotificationId] = useState<string | null>(null);

    useEffect(() => {
        if (!user || !isOpen) {
            setNotifications([]);
            return;
        }

        setIsLoading(true);
        const userNotificationsRef = collection(db, `userNotifications/${user.uid}/notifications`);
        const q = query(userNotificationsRef, orderBy('createdAt', 'desc'));

        const unsubscribe = onSnapshot(q, (querySnapshot) => {
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
        }, (error) => {
            console.error("Error fetching notifications:", error);
            showErrorToast("Could not load notifications.");
            setIsLoading(false);
        });

        return () => unsubscribe();
    }, [user, isOpen]);

    const handleMarkAsRead = async (notificationId: string) => {
        if (!user) return;
        const notificationRef = doc(db, `userNotifications/${user.uid}/notifications/${notificationId}`);
        try {
            await updateDoc(notificationRef, { isRead: true });
            // UI will update via onSnapshot listener
        } catch (error) {
            console.error("Error marking notification as read:", error);
        }
    };

    const handleMarkAllAsRead = async () => {
        if (!user || notifications.filter(n => !n.isRead).length === 0) return;
        const batch = writeBatch(db);
        notifications.forEach(notif => {
            if (!notif.isRead) {
                const notifRef = doc(db, `userNotifications/${user.uid}/notifications`, notif.id);
                batch.update(notifRef, { isRead: true });
            }
        });
        try {
            await batch.commit();
            showSuccessToast("All notifications marked as read.");
        } catch (error) {
            console.error("Error marking all as read:", error);
            showErrorToast("Failed to mark all as read.");
        }
    };

    const handleAddHangoutToCalendar = async (notification: UserNotificationClient) => {
        if (!user || !notification.confirmedSlotStart || !notification.confirmedSlotEnd || !notification.hangoutRequestName) {
            showErrorToast("Missing details to add event.");
            return;
        }
        setProcessingNotificationId(notification.id);
        const newCalendarEventData: Omit<CalendarEvent, 'id'> = {
            title: `Hangout: ${notification.hangoutRequestName}`,
            start: notification.confirmedSlotStart,
            end: notification.confirmedSlotEnd,
            allDay: false,
            color: '#4CAF50', // Consistent hangout color
            hangoutRequestId: notification.hangoutRequestId, // Link it
            // Add other necessary fields
        };

        try {
            await addCalendarItem(user.uid, newCalendarEventData);
            showSuccessToast(`"${newCalendarEventData.title}" added to your calendar!`);
            // Optionally mark as read or provide further action
            if (!notification.isRead) {
                handleMarkAsRead(notification.id);
            }
        } catch (error) {
            console.error("Error adding hangout to calendar:", error);
            showErrorToast("Failed to add event to your calendar.");
        } finally {
            setProcessingNotificationId(null);
        }
    };

    const unreadCount = notifications.filter(n => !n.isRead).length;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Notifications ${unreadCount > 0 ? `(${unreadCount} unread)` : ''}`} size="md">
            <div className="max-h-[70vh] overflow-y-auto pr-2">
                {isLoading ? (
                    <p className="text-center text-gray-500 py-4">Loading notifications...</p>
                ) : notifications.length === 0 ? (
                    <p className="text-center text-gray-500 py-10">You have no notifications.</p>
                ) : (
                    <div className="space-y-3">
                        {notifications.filter(n => !n.isRead).length > 0 && (
                            <div className="text-right mb-3">
                                <Button variant="link" size="sm" onClick={handleMarkAllAsRead} className="text-xs">
                                    Mark all as read
                                </Button>
                            </div>
                        )}
                        {notifications.map((notif) => (
                            <div
                                key={notif.id}
                                className={`p-3 rounded-lg border ${notif.isRead ? 'bg-gray-50 border-gray-200' : 'bg-blue-50 border-blue-300 shadow-sm'
                                    }`}
                            >
                                <div className="flex justify-between items-start">
                                    <p className={`text-sm ${notif.isRead ? 'text-gray-700' : 'text-blue-800 font-medium'}`}>
                                        {notif.message}
                                    </p>
                                    {!notif.isRead && (
                                        <Button variant="ghost" size="sm" className="p-1 h-auto text-xs" onClick={() => handleMarkAsRead(notif.id)}>
                                            Mark as read
                                        </Button>
                                    )}
                                </div>
                                <p className="text-xs text-gray-400 mt-1">
                                    {format(notif.createdAt, 'MMM d, yyyy, hh:mm a')}
                                </p>
                                {notif.type === 'hangout_invitation' && notif.confirmedSlotStart && (
                                    <div className="mt-2 pt-2 border-t border-gray-200">
                                        <div className="flex items-center justify-between">
                                            <Link href={`/hangouts/reply/${notif.hangoutRequestId}`} className="text-xs text-blue-600 hover:underline" onClick={onClose}>
                                                View Hangout Details
                                            </Link>
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() => handleAddHangoutToCalendar(notif)}
                                                isLoading={processingNotificationId === notif.id}
                                                disabled={processingNotificationId === notif.id}
                                                className="text-xs bg-green-500 hover:bg-green-600 text-white"
                                            >
                                                <CalendarIcon className="h-4 w-4 mr-1.5"/>
                                                Add to My Calendar
                                            </Button>
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
