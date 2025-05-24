// src/utils/eventUtils.ts
import { CalendarEvent } from '@/types/events';
import {
  addDays,
  addMonths, // For monthly repeats if we add them
  addYears,  // For yearly repeats if we add them
  getDay,    // 0 (Sun) to 6 (Sat)
  isWithinInterval,
  isBefore,
  isEqual,
  startOfDay,
  endOfDay,
  format,
  max, // Helper to find the later of two dates
  min  // Helper to find the earlier of two dates
} from 'date-fns';

// Helper to map 'SUN', 'MON' to 0, 1 etc. (date-fns getDay format)
const dayKeyToDayIndex = (dayKey: CalendarEvent['repeatDays'] extends (infer U)[] ? U : never): number => {
  const map = { SUN: 0, MON: 1, TUE: 2, WED: 3, THU: 4, FRI: 5, SAT: 6 };
  return map[dayKey];
};

export function expandRecurringEvents(
  masterCalendarItems: CalendarEvent[], // All stored events/stamps
  viewWindowStart: Date,          // Start of the visible calendar range
  viewWindowEnd: Date             // End of the visible calendar range
): CalendarEvent[] {
  const allDisplayedEvents: CalendarEvent[] = [];
  const processedMasterStampIds = new Set<string>(); // To avoid re-processing master if it's also an occurrence

  masterCalendarItems.forEach(masterItem => {
    // If it's a recurring stamp definition
    if (
      masterItem.isStamp &&
      masterItem.repeatDays && masterItem.repeatDays.length > 0 &&
      masterItem.repeatEndDate &&
      !masterItem.originalStampId // Ensure it's a master definition, not an already applied instance
    ) {
      processedMasterStampIds.add(masterItem.id); // Mark master as processed for recurrence

      const stampMasterStartDate = startOfDay(new Date(masterItem.start)); // Date part of when recurrence begins
      const seriesEndDate = endOfDay(new Date(masterItem.repeatEndDate)); // When the series itself ends

      // Determine the loop start: later of (view window start, stamp master start)
      // minus some buffer to catch events starting just before the window but visible in it.
      const loopStartDate = max([startOfDay(viewWindowStart), stampMasterStartDate]);
      
      // Determine the loop end: earlier of (view window end, series end date)
      const loopEndDate = min([endOfDay(viewWindowEnd), seriesEndDate]);

      if (isBefore(loopEndDate, loopStartDate)) { // If the effective loop range is invalid, skip
        return; // Continue to next masterItem
      }
      
      const masterStampStartTime = new Date(masterItem.start); // Time of day for the stamp
      const masterStampEndTime = new Date(masterItem.end);     // Time of day for the stamp
      const durationMs = masterStampEndTime.getTime() - masterStampStartTime.getTime();
      if (durationMs < 0) return; // Invalid duration

      const repeatDayIndexes = masterItem.repeatDays.map(dayKeyToDayIndex);

      let currentDateInLoop = new Date(loopStartDate);

      while (isBefore(currentDateInLoop, loopEndDate) || isEqual(currentDateInLoop, loopEndDate)) {
        // Check if current date in loop is on or after the stamp's actual start date
        // and before or on the series end date.
        if (isBefore(currentDateInLoop, stampMasterStartDate)) {
          currentDateInLoop = addDays(currentDateInLoop, 1);
          continue;
        }

        const dayOfWeek = getDay(currentDateInLoop); // 0 for Sunday, 1 for Monday...

        if (repeatDayIndexes.includes(dayOfWeek)) {
          // This day matches a repeat day, create an occurrence
          const occurrenceStart = new Date(currentDateInLoop);
          occurrenceStart.setHours(
            masterStampStartTime.getHours(),
            masterStampStartTime.getMinutes(),
            masterStampStartTime.getSeconds()
          );
          
          const occurrenceEnd = new Date(occurrenceStart.getTime() + durationMs);

          // Ensure this specific occurrence is within the master stamp's overall active period
          if (isAfter(occurrenceStart, seriesEndDate)) break; // Stop if we've passed the series end date

          allDisplayedEvents.push({
            ...masterItem, // Copy properties from master stamp
            id: `${masterItem.id}_${format(occurrenceStart, 'yyyyMMdd')}`, // Unique ID for this occurrence
            originalStampId: masterItem.id,
            occurrenceDate: new Date(occurrenceStart), // Specific date of this instance
            start: occurrenceStart,
            end: occurrenceEnd,
            // Clear repeat rules for the occurrence itself
            repeatDays: undefined,
            repeatEndDate: undefined,
            isStamp: true, // It's an instance derived from a stamp
            // allDay is copied from masterItem. If stamps are never allDay, ensure masterItem.allDay is false.
          });
        }
        currentDateInLoop = addDays(currentDateInLoop, 1);
      }
    } else if (!masterItem.originalStampId && !processedMasterStampIds.has(masterItem.id)) {
      // It's a regular event or a non-recurring master stamp that hasn't been processed as recurring.
      // Add it directly if it falls within the view window (react-big-calendar will also filter, but this can be an optimization)
      // For simplicity here, we'll add all non-recurring items and let RBC handle visibility.
      // More advanced: check if masterItem.start/end overlaps with viewWindowStart/viewWindowEnd.
      allDisplayedEvents.push(masterItem);
    } else if (masterItem.originalStampId) {
      // It's an ALREADY APPLIED single stamp instance (not a recurring master)
      // These should already be in masterCalendarItems from Firestore.
      // Add it directly if it's not a duplicate from recurrence expansion.
      // For simplicity, add all and let RBC handle view.
      allDisplayedEvents.push(masterItem);
    }
  });
  
  // Deduplicate: In case a master stamp itself falls on a day it also recurs
  // and was added both as a master and an occurrence.
  // A more robust way is to ensure master stamps are not re-added if expanded.
  // The `processedMasterStampIds` check helps, but let's add a final dedupe by ID.
  const uniqueEvents = Array.from(new Map(allDisplayedEvents.map(event => [event.id, event])).values());

  return uniqueEvents;
}

// Helper function to check if date is after or equal
function isAfter(date: Date, dateToCompare: Date) {
    return date.getTime() > dateToCompare.getTime();
}