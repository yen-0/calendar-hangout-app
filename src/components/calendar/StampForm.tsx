// src/components/calendar/StampForm.tsx
'use client';

import React, { useState, useEffect, useRef } from 'react';
import { CalendarEvent } from '@/types/events'; // Assuming this type is comprehensive
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import EmojiPicker, { EmojiClickData, Theme as EmojiTheme } from 'emoji-picker-react';

// Helper to format Date to 'yyyy-MM-ddThh:mm' for datetime-local input
const formatDateForInput = (date: Date | undefined | null): string => {
  if (!date) return '';
  const d = new Date(date);
  const timezoneOffset = d.getTimezoneOffset() * 60000;
  const localDate = new Date(d.getTime() - timezoneOffset);
  return localDate.toISOString().slice(0, 16);
};

// Helper to format Date to 'yyyy-MM-dd' for date input
const formatDateForDateInput = (date: Date | undefined | null): string => {
    if (!date) return '';
    return new Date(date).toISOString().split('T')[0];
};




const daysOfWeekMap: { key: NonNullable<CalendarEvent['repeatDays']>[number]; label: string }[] = [
    { key: 'SUN', label: 'Sun' }, { key: 'MON', label: 'Mon' }, { key: 'TUE', label: 'Tue' },
    { key: 'WED', label: 'Wed' }, { key: 'THU', label: 'Thu' }, { key: 'FRI', label: 'Fri' },
    { key: 'SAT', label: 'Sat' },
];

interface StampFormProps {
  stamp?: Partial<CalendarEvent> | null; // Stamp data for editing, or null for new
  onSave: (stampData: Omit<CalendarEvent, 'id'> & { id?: string }) => void;
  onCancel: () => void;
  onDelete?: (stampId: string) => void; // Optional: for deleting existing stamps
}

const StampForm: React.FC<StampFormProps> = ({
  stamp, // Renamed from 'event' for clarity
  onSave,
  onCancel,
  onDelete,
}) => {
  const [title, setTitle] = useState(''); // This is the "Label"
  const [start, setStart] = useState<string>(''); // Start time of one stamp instance
  const [end, setEnd] = useState<string>('');   // End time of one stamp instance
  const [color, setColor] = useState('#4f46e5'); // Default indigo for stamps
  const [emoji, setEmoji] = useState<string | undefined>(undefined);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [repeatDays, setRepeatDays] = useState<Set<string>>(new Set());
  const [repeatEndDate, setRepeatEndDate] = useState<string>('');
  const emojiPickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const defaultStartTime = new Date();
    defaultStartTime.setHours(9, 0, 0, 0); // Default 9 AM
    const defaultEndTime = new Date();
    defaultEndTime.setHours(10, 0, 0, 0); // Default 10 AM (1 hour duration)

    if (stamp) {
      setTitle(stamp.title || '');
      setStart(formatDateForInput(stamp.start || defaultStartTime));
      setEnd(formatDateForInput(stamp.end || defaultEndTime));
      setColor(stamp.color || '#4f46e5');
      setEmoji(stamp.emoji);
      setRepeatDays(new Set(stamp.repeatDays || []));
      setRepeatEndDate(formatDateForDateInput(stamp.repeatEndDate));
    } else {
      // New stamp
      setTitle('');
      setStart(formatDateForInput(defaultStartTime));
      setEnd(formatDateForInput(defaultEndTime));
      setColor('#4f46e5');
      setEmoji(undefined);
      setRepeatDays(new Set());
      setRepeatEndDate('');
    }
  }, [stamp]);

  useEffect(() => { /* ... handleClickOutside for emoji picker ... */ 
    function handleClickOutside(event: MouseEvent) {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(event.target as Node)) {
        setShowEmojiPicker(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [emojiPickerRef]);


  const handleEmojiClick = (emojiData: EmojiClickData) => { /* ... same ... */ setEmoji(emojiData.emoji); setShowEmojiPicker(false); };
  const toggleRepeatDay = (dayKey: string) => { /* ... same ... */ setRepeatDays(prev => { const newSet = new Set(prev); if (newSet.has(dayKey)) newSet.delete(dayKey); else newSet.add(dayKey); return newSet; }); };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) { alert("Stamp Label is required."); return; }
    if (!emoji) { alert("Please select an Emoji for the stamp."); return; }
    if (!start || !end) { alert("Start and End times are required for the stamp instance."); return; }
    
    const startDate = new Date(start);
    const endDate = new Date(end);
    if (endDate <= startDate) { alert("Stamp instance End time must be after Start time."); return; }

    if (repeatDays.size > 0 && !repeatEndDate) { alert("Please select a Repeat Until date for the recurring stamp."); return; }
    
    let parsedRepeatEndDate;
    if (repeatDays.size > 0 && repeatEndDate) {
        parsedRepeatEndDate = new Date(repeatEndDate);
        const stampInstanceStartDate = new Date(start.split('T')[0]); // Date part of the first occurrence
         // Ensure repeat end date is not before the stamp's first possible occurrence (using date part of start time)
        if (parsedRepeatEndDate < stampInstanceStartDate) {
            alert("Repeat Until date cannot be before the stamp's effective start date.");
            return;
        }
    }

    const stampData: Omit<CalendarEvent, 'id'> & { id?: string } = {
      title: title.trim(),
      start: startDate, // Start time for an instance of the stamp
      end: endDate,     // End time for an instance of the stamp
      color,
      isStamp: true, // This form ALWAYS creates/edits stamps
      emoji,
      repeatDays: repeatDays.size > 0 ? Array.from(repeatDays) as CalendarEvent['repeatDays'] : undefined,
      repeatEndDate: parsedRepeatEndDate ? parsedRepeatEndDate : undefined,
      allDay: false, // Stamps are typically not all-day in the same way events are; they have a duration
    };

    if (stamp?.id) {
      stampData.id = stamp.id;
    }
    onSave(stampData);
  };

  const isEditing = !!stamp?.id;

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-h-[80vh] overflow-y-auto p-1">
      {/* Event Type Toggle REMOVED - This form is only for Stamps */}
      
      <div>
        <Label htmlFor="stamp-label">Stamp Label</Label>
        <Input id="stamp-label" type="text" value={title} onChange={(e) => setTitle(e.target.value)} required />
      </div>

      <div className="relative">
        <Label htmlFor="stamp-emoji">Emoji Icon</Label>
        <Button type="button" variant="outline" onClick={() => setShowEmojiPicker(!showEmojiPicker)} className="w-full flex justify-start items-center text-left mt-1">
          {emoji ? <span className="text-2xl mr-2">{emoji}</span> : 'Select Emoji'}
        </Button>
        {showEmojiPicker && (
          <div ref={emojiPickerRef} className="absolute z-10 mt-1"><EmojiPicker onEmojiClick={handleEmojiClick} autoFocusSearch={false} theme={EmojiTheme.AUTO} lazyLoadEmojis /></div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="stamp-start">Instance Start Time</Label>
          <Input id="stamp-start" type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} required />
        </div>
        <div>
          <Label htmlFor="stamp-end">Instance End Time</Label>
          <Input id="stamp-end" type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} required />
        </div>
      </div>
      
      {/* All-day checkbox REMOVED for stamps; duration is explicit */}

      <div>
        <Label htmlFor="stamp-color">Color</Label>
        <Input id="stamp-color" type="color" value={color} onChange={(e) => setColor(e.target.value)} className="mt-1 h-10 w-full" />
      </div>

      <div className="space-y-4 pt-4 border-t">
        <Label className="block text-lg font-semibold">Repeat Options</Label>
        <div>
          <Label>Repeat on Days:</Label>
          <div className="mt-2 grid grid-cols-3 sm:grid-cols-4 md:grid-cols-7 gap-2">
            {daysOfWeekMap.map((day) => (
              <Button type="button" key={day.key} variant={repeatDays.has(day.key) ? 'default' : 'outline'} onClick={() => toggleRepeatDay(day.key)} className="text-xs sm:text-sm">{day.label}</Button>
            ))}
          </div>
        </div>
        {repeatDays.size > 0 && (
          <div>
            <Label htmlFor="stamp-repeat-end">Repeat Until:</Label>
            <Input id="stamp-repeat-end" type="date" value={repeatEndDate} onChange={(e) => setRepeatEndDate(e.target.value)} className="mt-1" required={repeatDays.size > 0} />
          </div>
        )}
      </div>

      <div className="flex justify-end space-x-3 pt-6 border-t">
        {isEditing && onDelete && (
          <Button type="button" variant="destructive" onClick={() => onDelete(stamp!.id!)}>Delete Stamp</Button>
        )}
        <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
        <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white">
          {isEditing ? 'Save Stamp' : 'Create Stamp'}
        </Button>
      </div>
    </form>
  );
};

export default StampForm;