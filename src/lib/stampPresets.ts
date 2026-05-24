import { CalendarEvent, StampAvailability } from '@/types/events';

export interface StampPreset {
  title: string;
  emoji: string;
  color: string;
  category: string;
  /** Hour-of-day (0-23) for the placed instance's start time. */
  startHour: number;
  /** Duration in minutes. */
  durationMinutes: number;
  availability?: StampAvailability;
}

/**
 * Curated starter stamps. Surfaced as one-tap "add" cards when a user has no
 * stamps yet. Designed to be a recognizable mix across health, work, social,
 * and personal — opinionated enough to feel useful, broad enough to seed
 * almost any user's starting set.
 */
export const STAMP_PRESETS: StampPreset[] = [
  { title: 'Gym', emoji: '🏋️', color: '#16a34a', category: 'Health', startHour: 7, durationMinutes: 60 },
  { title: 'Run', emoji: '🏃', color: '#22c55e', category: 'Health', startHour: 6, durationMinutes: 45 },
  { title: 'Read', emoji: '📚', color: '#a855f7', category: 'Habits', startHour: 21, durationMinutes: 30 },
  { title: 'Standup', emoji: '🧍', color: '#0ea5e9', category: 'Work', startHour: 9, durationMinutes: 15 },
  { title: 'Deep work', emoji: '🧠', color: '#1d4ed8', category: 'Work', startHour: 10, durationMinutes: 120 },
  { title: '1:1', emoji: '🤝', color: '#0284c7', category: 'Work', startHour: 14, durationMinutes: 30 },
  { title: 'Date night', emoji: '🥂', color: '#db2777', category: 'Social', startHour: 19, durationMinutes: 120 },
  { title: 'Therapy', emoji: '🛋️', color: '#f59e0b', category: 'Health', startHour: 17, durationMinutes: 50 },
  { title: 'Meal prep', emoji: '🍳', color: '#f97316', category: 'Habits', startHour: 18, durationMinutes: 60 },
  { title: 'Travel day', emoji: '✈️', color: '#0891b2', category: 'Travel', startHour: 8, durationMinutes: 480 },
  { title: 'Free for lunch', emoji: '🥗', color: '#84cc16', category: 'Social', startHour: 12, durationMinutes: 60, availability: 'free' },
  { title: 'Sleep early', emoji: '🌙', color: '#6366f1', category: 'Habits', startHour: 22, durationMinutes: 60 },
];

/**
 * Materialize a preset into the same Omit<CalendarEvent,'id'> shape that
 * store.addEvent expects. Anchored to today so the date itself doesn't matter
 * — what survives is the time-of-day and duration, which is how stamps work.
 */
export function presetToStamp(p: StampPreset): Omit<CalendarEvent, 'id'> {
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate(), p.startHour, 0, 0, 0);
  const end = new Date(start.getTime() + p.durationMinutes * 60_000);
  return {
    title: p.title,
    emoji: p.emoji,
    color: p.color,
    start,
    end,
    isStamp: true,
    allDay: false,
    stampCategory: p.category,
    stampAvailability: p.availability ?? 'busy',
  };
}
