'use client';

import React, { useEffect, useRef, useState } from 'react';
import EmojiPicker, { EmojiClickData, Theme as EmojiTheme } from 'emoji-picker-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LocationAutocomplete } from '@/components/location/LocationAutocomplete';
import { useLanguage } from '@/hooks/useLanguage';
import { useUserPreferences } from '@/hooks/useUserPreferences';
import { CalendarEvent, CalendarEventUpdate, EventLocation, StampAvailability, TravelMode } from '@/types/events';

const formatDateForInput = (date: Date | undefined | null): string => {
  if (!date) return '';
  const d = new Date(date);
  const timezoneOffset = d.getTimezoneOffset() * 60000;
  const localDate = new Date(d.getTime() - timezoneOffset);
  return localDate.toISOString().slice(0, 16);
};

const formatDateForDateInput = (date: Date | undefined | null): string => {
  if (!date) return '';
  return new Date(date).toISOString().split('T')[0];
};

type StampFormSaveData = CalendarEventUpdate & {
  id?: string;
  title: string;
  start: Date;
  end: Date;
};

interface StampFormProps {
  stamp?: Partial<CalendarEvent> | null;
  onSave: (stampData: StampFormSaveData) => void;
  onCancel: () => void;
  onDelete?: (stampId: string) => void;
  existingCategories?: string[];
}

const daysOfWeek = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'] as const;

const StampForm: React.FC<StampFormProps> = ({ stamp, onSave, onCancel, onDelete, existingCategories = [] }) => {
  const { t } = useLanguage();
  const { prefs } = useUserPreferences();
  const [title, setTitle] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [color, setColor] = useState('#4f46e5');
  const [emoji, setEmoji] = useState<string | undefined>(undefined);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [repeatDays, setRepeatDays] = useState<Set<string>>(new Set());
  const [repeatEndDate, setRepeatEndDate] = useState('');
  const [availability, setAvailability] = useState<StampAvailability>('busy');
  const [category, setCategory] = useState('');
  const [location, setLocation] = useState<EventLocation | undefined>(undefined);
  const [travelMode, setTravelMode] = useState<TravelMode>('transit');
  const emojiPickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const defaultStartTime = new Date();
    defaultStartTime.setHours(9, 0, 0, 0);
    const defaultEndTime = new Date();
    defaultEndTime.setHours(10, 0, 0, 0);

    if (stamp) {
      setTitle(stamp.title || '');
      setStart(formatDateForInput(stamp.start || defaultStartTime));
      setEnd(formatDateForInput(stamp.end || defaultEndTime));
      setColor(stamp.color || '#4f46e5');
      setEmoji(stamp.emoji);
      setRepeatDays(new Set(stamp.repeatDays || []));
      setRepeatEndDate(formatDateForDateInput(stamp.repeatEndDate));
      setAvailability(stamp.stampAvailability ?? 'busy');
      setCategory(stamp.stampCategory ?? '');
      setLocation(stamp.location);
      setTravelMode(stamp.travelMode ?? 'transit');
    } else {
      setTitle('');
      setStart(formatDateForInput(defaultStartTime));
      setEnd(formatDateForInput(defaultEndTime));
      setColor('#4f46e5');
      setEmoji(undefined);
      setRepeatDays(new Set());
      setRepeatEndDate('');
      setAvailability('busy');
      setCategory('');
      setLocation(undefined);
      setTravelMode('transit');
    }
  }, [stamp]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(event.target as Node)) {
        setShowEmojiPicker(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleEmojiClick = (emojiData: EmojiClickData) => {
    setEmoji(emojiData.emoji);
    setShowEmojiPicker(false);
  };

  const toggleRepeatDay = (dayKey: string) => {
    setRepeatDays((prev) => {
      const next = new Set(prev);
      if (next.has(dayKey)) next.delete(dayKey);
      else next.add(dayKey);
      return next;
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return alert(t.stampForm.requiredLabel);
    if (!emoji) return alert(t.stampForm.requiredEmoji);
    if (!start || !end) return alert(t.stampForm.requiredTimes);

    const startDate = new Date(start);
    const endDate = new Date(end);
    if (endDate <= startDate) return alert(t.stampForm.endAfterStart);

    if (repeatDays.size > 0 && !repeatEndDate) return alert(t.stampForm.requiredRepeatUntil);

    let parsedRepeatEndDate: Date | undefined;
    if (repeatDays.size > 0 && repeatEndDate) {
      parsedRepeatEndDate = new Date(repeatEndDate);
      const stampInstanceStartDate = new Date(start.split('T')[0]);
      if (parsedRepeatEndDate < stampInstanceStartDate) {
        alert(t.stampForm.repeatUntilBeforeStart);
        return;
      }
    }

    const hadLocation = !!stamp?.location;
    const locationField: EventLocation | null | undefined = location
      ? location
      : hadLocation
        ? null
        : undefined;
    const travelModeField: TravelMode | null | undefined = location
      ? travelMode
      : hadLocation
        ? null
        : undefined;

    const stampData: StampFormSaveData = {
      title: title.trim(),
      start: startDate,
      end: endDate,
      color,
      isStamp: true,
      emoji,
      repeatDays: repeatDays.size > 0 ? (Array.from(repeatDays) as CalendarEvent['repeatDays']) : undefined,
      repeatEndDate: parsedRepeatEndDate,
      allDay: false,
      stampAvailability: availability,
      stampCategory: category.trim() ? category.trim() : undefined,
      location: locationField,
      travelMode: travelModeField,
    };

    if (stamp?.id) stampData.id = stamp.id;
    onSave(stampData);
  };

  const isEditing = !!stamp?.id;
  const dayLabels = t.stampForm.weekdayLabels;

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-h-[80vh] overflow-y-auto p-1">
      <div>
        <Label htmlFor="stamp-label">{t.stampForm.label}</Label>
        <Input id="stamp-label" type="text" value={title} onChange={(e) => setTitle(e.target.value)} required />
      </div>

      <div>
        <Label htmlFor="stamp-category">{t.stampForm.category}</Label>
        <Input
          id="stamp-category"
          type="text"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          list="stamp-category-suggestions"
          placeholder={t.stampForm.categoryPlaceholder}
        />
        {existingCategories.length > 0 && (
          <datalist id="stamp-category-suggestions">
            {existingCategories.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        )}
      </div>

      <div className="relative">
        <Label htmlFor="stamp-emoji">{t.stampForm.emoji}</Label>
        <Button
          type="button"
          variant="outline"
          onClick={() => setShowEmojiPicker(!showEmojiPicker)}
          className="mt-1 flex w-full items-center justify-start text-left"
        >
          {emoji ? <span className="mr-2 text-2xl">{emoji}</span> : t.stampForm.selectEmoji}
        </Button>
        {showEmojiPicker && (
          <div ref={emojiPickerRef} className="absolute z-10 mt-1">
            <EmojiPicker onEmojiClick={handleEmojiClick} autoFocusSearch={false} theme={EmojiTheme.AUTO} lazyLoadEmojis />
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <Label htmlFor="stamp-start">{t.stampForm.start}</Label>
          <Input id="stamp-start" type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} required />
        </div>
        <div>
          <Label htmlFor="stamp-end">{t.stampForm.end}</Label>
          <Input id="stamp-end" type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} required />
        </div>
      </div>

      <div>
        <Label htmlFor="stamp-color">{t.stampForm.color}</Label>
        <Input id="stamp-color" type="color" value={color} onChange={(e) => setColor(e.target.value)} className="mt-1 h-10 w-full" />
      </div>

      {prefs.locationFeaturesEnabled && (
        <div className="space-y-2 border-t pt-4">
          <Label htmlFor="stamp-location">{t.stampForm.defaultLocation}</Label>
          <p className="text-[10px] text-gray-500 -mt-1">{t.stampForm.locationHelp}</p>
          <LocationAutocomplete inputId="stamp-location" value={location} onChange={setLocation} />
          {location && (
            <div>
              <Label htmlFor="stamp-travel-mode" className="text-xs">
                {t.stampForm.travelMode}
              </Label>
              <select
                id="stamp-travel-mode"
                value={travelMode}
                onChange={(e) => setTravelMode(e.target.value as TravelMode)}
                className="mt-1 block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
              >
                <option value="transit">{t.stampForm.transit}</option>
                <option value="walk">{t.stampForm.walk}</option>
                <option value="drive">{t.stampForm.drive}</option>
              </select>
            </div>
          )}
        </div>
      )}

      <div className="space-y-2 border-t pt-4">
        <Label className="block">{t.stampForm.availability}</Label>
        <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label={t.stampForm.availability}>
          {(
            [
              { key: 'busy', label: t.stampForm.busy, hint: t.stampForm.busyHint },
              { key: 'free', label: t.stampForm.free, hint: t.stampForm.freeHint },
              { key: 'tentative', label: t.stampForm.tentative, hint: t.stampForm.tentativeHint },
            ] as { key: StampAvailability; label: string; hint: string }[]
          ).map((opt) => {
            const selected = availability === opt.key;
            return (
              <Button
                key={opt.key}
                type="button"
                variant={selected ? 'default' : 'outline'}
                onClick={() => setAvailability(opt.key)}
                aria-pressed={selected}
                className="flex h-auto flex-col items-start px-3 py-2 text-left whitespace-normal"
              >
                <span className="text-sm font-medium">{opt.label}</span>
                <span className={`text-[10px] ${selected ? 'text-white/85' : 'text-gray-500'}`}>{opt.hint}</span>
              </Button>
            );
          })}
        </div>
      </div>

      <div className="space-y-4 border-t pt-4">
        <Label className="block text-lg font-semibold">{t.stampForm.repeatOptions}</Label>
        <div>
          <Label>{t.stampForm.repeatDays}</Label>
          <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-7">
            {daysOfWeek.map((day) => (
              <Button
                type="button"
                key={day}
                variant={repeatDays.has(day) ? 'default' : 'outline'}
                onClick={() => toggleRepeatDay(day)}
                className="text-xs sm:text-sm"
              >
                {dayLabels[day]}
              </Button>
            ))}
          </div>
        </div>
        {repeatDays.size > 0 && (
          <div>
            <Label htmlFor="stamp-repeat-end">{t.stampForm.repeatUntil}</Label>
            <Input
              id="stamp-repeat-end"
              type="date"
              value={repeatEndDate}
              onChange={(e) => setRepeatEndDate(e.target.value)}
              className="mt-1"
              required={repeatDays.size > 0}
            />
          </div>
        )}
      </div>

      <div className="flex justify-end space-x-3 border-t pt-6">
        {isEditing && onDelete && (
          <Button type="button" variant="destructive" onClick={() => onDelete(stamp!.id!)}>
            {t.stampForm.deleteStamp}
          </Button>
        )}
        <Button type="button" variant="outline" onClick={onCancel}>
          {t.common.cancel}
        </Button>
        <Button type="submit" className="bg-indigo-600 text-white hover:bg-indigo-700">
          {isEditing ? t.stampForm.saveStamp : t.stampForm.createStamp}
        </Button>
      </div>
    </form>
  );
};

export default StampForm;
