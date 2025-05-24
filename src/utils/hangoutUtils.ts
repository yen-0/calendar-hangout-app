// src/utils/hangoutUtils.ts
import { CalendarEvent } from '@/types/events';
import { DateRange, TimeRange, ParticipantEvent } from '@/types/hangouts';
import { expandRecurringEvents } from './eventUtils'; // Assuming this exists and works
import { isWithinInterval, setHours, setMinutes, setSeconds, parse as parseTime, startOfDay, endOfDay } from 'date-fns';
import { HangoutRequest} from '@/types/hangouts';
import {
  addMinutes,
  eachMinuteOfInterval,
  getHours,
  getMinutes,
  isBefore,
  isAfter,
  isEqual,
  max,
  min
} from 'date-fns';
/**
 * Filters and prepares a user's calendar events to fit within the hangout request's date and time ranges.
 * @param userEvents All of the user's base calendar events (including master stamps).
 * @param requestDateRanges The date ranges specified in the hangout request.
 * @param requestTimeRanges The time ranges specified for each day in the hangout request.
 * @returns An array of ParticipantEvent objects representing the user's busy times.
 */
export const prepareCreatorEventsForRequest = (
  userEvents: CalendarEvent[],
  requestDateRanges: DateRange[],
  requestTimeRanges: TimeRange[]
): ParticipantEvent[] => {
  const relevantEvents: ParticipantEvent[] = [];

  if (!userEvents || userEvents.length === 0) return [];

  // 1. Determine the overall earliest start and latest end from all requestDateRanges
  //    to pass a sensible window to expandRecurringEvents.
  let overallStart = requestDateRanges[0]?.start;
  let overallEnd = requestDateRanges[0]?.end;

  requestDateRanges.forEach(dr => {
    if (dr.start < overallStart) overallStart = dr.start;
    if (dr.end > overallEnd) overallEnd = dr.end;
  });

  if (!overallStart || !overallEnd) return []; // Should not happen if requestDateRanges is valid

  // 2. Expand recurring events for this overall window.
  //    Make sure overallStart and overallEnd are actual Date objects
  const expandedUserEvents = expandRecurringEvents(userEvents, new Date(overallStart), new Date(overallEnd));

  // 3. Iterate through each day within each requestDateRange
  for (const reqDR of requestDateRanges) {
    let currentDate = startOfDay(new Date(reqDR.start)); // Ensure Date object
    const endDate = endOfDay(new Date(reqDR.end));     // Ensure Date object

    while (currentDate <= endDate) {
      // For each day, check against each requestTimeRange
      for (const reqTR of requestTimeRanges) {
        const timeRangeStart = parseTime(reqTR.start, 'HH:mm', new Date());
        const timeRangeEnd = parseTime(reqTR.end, 'HH:mm', new Date());

        const dayTimeSlotStart = setSeconds(setMinutes(setHours(currentDate, timeRangeStart.getHours()), timeRangeStart.getMinutes()), 0);
        const dayTimeSlotEnd = setSeconds(setMinutes(setHours(currentDate, timeRangeEnd.getHours()), timeRangeEnd.getMinutes()), 0);
        
        // If time range spans midnight (e.g., 22:00 to 02:00), this simple check won't work.
        // Assuming time ranges are within a single day for now.
        if (dayTimeSlotEnd <= dayTimeSlotStart) {
            console.warn(`Skipping invalid time range for day ${currentDate}: ${reqTR.start} - ${reqTR.end}`);
            continue;
        }

        // 4. Filter expandedUserEvents that fall within this specific day's time slot
        expandedUserEvents.forEach(event => {
          const eventStart = new Date(event.start);
          const eventEnd = new Date(event.end);

          // Check if the event (eventStart to eventEnd) overlaps with the day's time slot (dayTimeSlotStart to dayTimeSlotEnd)
          const overlaps = eventStart < dayTimeSlotEnd && eventEnd > dayTimeSlotStart;

          if (overlaps) {
            // Clip the event to the bounds of the day's time slot if it extends beyond
            const actualStart = eventStart < dayTimeSlotStart ? dayTimeSlotStart : eventStart;
            const actualEnd = eventEnd > dayTimeSlotEnd ? dayTimeSlotEnd : eventEnd;
            
            // Only add if the clipped event still has positive duration
            if (actualEnd > actualStart) {
                 relevantEvents.push({
                    title: event.title,
                    start: actualStart,
                    end: actualEnd,
                });
            }
          }
        });
      }
      currentDate.setDate(currentDate.getDate() + 1); // Move to the next day
    }
  }
  
  // Deduplicate events (in case an event spans multiple time slots or date ranges and gets added multiple times)
  const uniqueEventsMap = new Map<string, ParticipantEvent>();
  relevantEvents.forEach(event => {
    const key = `${event.title}_${event.start.toISOString()}_${event.end.toISOString()}`;
    if (!uniqueEventsMap.has(key)) {
      uniqueEventsMap.set(key, event);
    }
  });

  return Array.from(uniqueEventsMap.values());
};

export interface CommonSlot {
  start: Date;
  end: Date;
  availableParticipants: string[]; // UIDs of participants available for this slot
}

/**
 * Checks if a participant is free during a specific time interval.
 * @param participantEvents The participant's busy events.
 * @param intervalStart The start of the interval to check.
 * @param intervalEnd The end of the interval to check.
 * @returns True if the participant is free, false otherwise.
 */
const isParticipantFree = (
  participantEvents: ParticipantEvent[],
  intervalStart: Date,
  intervalEnd: Date
): boolean => {
  for (const event of participantEvents) {
    // Check for overlap: (EventStart < IntervalEnd) and (EventEnd > IntervalStart)
    if (isBefore(event.start, intervalEnd) && isAfter(event.end, intervalStart)) {
      return false; // Participant has an overlapping event
    }
  }
  return true; // No overlapping events found
};


export const findCommonAvailability = (
  request: HangoutRequest,
  stepMinutes: number = 15 // Granularity of checks, e.g., check every 15 minutes
): CommonSlot[] => {
  const commonSlots: CommonSlot[] = [];
  if (!request.participants || Object.keys(request.participants).length < request.desiredMemberCount) {
    // Not enough participants have responded yet to meet the desired count
    return [];
  }

  const {
    dateRanges,
    timeRanges,
    desiredDurationMinutes,
    desiredMarginMinutes,
    desiredMemberCount,
    participants,
  } = request;

  const participantIds = Object.keys(participants);

  for (const dr of dateRanges) {
    let currentDay = startOfDay(new Date(dr.start)); // Ensure it's a new Date object
    const dateRangeEndDay = startOfDay(new Date(dr.end)); // Ensure it's a new Date object

    while (isBefore(currentDay, addMinutes(dateRangeEndDay, 1)) || isEqual(currentDay, dateRangeEndDay)) { // Loop through each day in the date range
      for (const tr of timeRanges) {
        const dayStartTimeStr = tr.start.split(':');
        const dayEndTimeStr = tr.end.split(':');

        let slotPotentialStart = setSeconds(setMinutes(setHours(new Date(currentDay), parseInt(dayStartTimeStr[0])), parseInt(dayStartTimeStr[1])),0);
        const timeRangeEndBoundary = setSeconds(setMinutes(setHours(new Date(currentDay), parseInt(dayEndTimeStr[0])), parseInt(dayEndTimeStr[1])),0);

        // Iterate through potential start times within this day's time range
        while (isBefore(slotPotentialStart, timeRangeEndBoundary)) {
          const slotRequiredStart = addMinutes(slotPotentialStart, desiredMarginMinutes);
          const slotRequiredEnd = addMinutes(slotRequiredStart, desiredDurationMinutes);
          const slotFullEndWithMargin = addMinutes(slotRequiredEnd, desiredMarginMinutes);

          // Ensure the full slot (including duration and both margins) fits within this day's time range boundary
          if (isAfter(slotFullEndWithMargin, timeRangeEndBoundary)) {
            break; // This potential slot (with margins) goes beyond the allowed time range for the day
          }

          const availableParticipantsForSlot: string[] = [];
          for (const pid of participantIds) {
            const participant = participants[pid];
            if (isParticipantFree(participant.events, slotRequiredStart, slotRequiredEnd)) {
              availableParticipantsForSlot.push(pid);
            }
          }

          if (availableParticipantsForSlot.length >= desiredMemberCount) {
            commonSlots.push({
              start: slotRequiredStart, // The actual meeting time, excluding pre-margin
              end: slotRequiredEnd,     // The actual meeting time, excluding post-margin
              availableParticipants: availableParticipantsForSlot,
            });
            // Optimization: Jump ahead by duration to avoid re-checking overlapping successful slots immediately.
            // Or, jump by stepMinutes if you want to find all possible distinct slots.
            // For now, let's jump by stepMinutes to find more granular slots.
            // slotPotentialStart = addMinutes(slotRequiredStart, desiredDurationMinutes); // Jump past this found slot
            // continue; // Restart the inner loop for the new potential start
          }
          slotPotentialStart = addMinutes(slotPotentialStart, stepMinutes);
        }
      }
      currentDay = addMinutes(startOfDay(currentDay), 24 * 60); // Move to the next day
    }
  }

  // Post-processing: Sort slots, merge overlapping/adjacent ones if desired (more complex)
  return commonSlots.sort((a,b) => a.start.getTime() - b.start.getTime());
};