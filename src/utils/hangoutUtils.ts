// src/utils/hangoutUtils.ts
import { CalendarEvent } from '@/types/events';
import {
    DateRangeClient,
    TimeRange,
    ParticipantEventClient,
    HangoutRequestClientState,
    CommonSlotClient,
    ParticipantDataClient
} from '@/types/hangouts';
import { expandRecurringEvents } from './eventUtils';
import {
    setHours,
    setMinutes,
    setSeconds,
    parse as parseTime,
    startOfDay,
    endOfDay, // You used endOfDay, ensure it's imported if needed, or stick to startOfDay logic
    addMinutes,
    isBefore,
    isAfter,
    isEqual,
    format,
    getHours,    // <--- IMPORT getHours
    getMinutes,  // <--- IMPORT getMinutes
    // getSeconds // <--- IMPORT getSeconds if you use it (not in current logic)
} from 'date-fns';

// ... (rest of the imports and interfaces if any locally defined)

export const prepareCreatorEventsForRequest = (
  userEvents: CalendarEvent[],
  requestDateRanges: DateRangeClient[],
  requestTimeRanges: TimeRange[]
): ParticipantEventClient[] => {
  const relevantEvents: ParticipantEventClient[] = [];

  if (!userEvents || userEvents.length === 0) return [];

  let overallStart = requestDateRanges[0]?.start;
  let overallEnd = requestDateRanges[0]?.end;

  requestDateRanges.forEach(dr => {
    if (isBefore(dr.start, overallStart)) overallStart = dr.start;
    if (isAfter(dr.end, overallEnd)) overallEnd = dr.end;
  });

  if (!overallStart || !overallEnd) return [];

  const expandedUserEvents = expandRecurringEvents(userEvents, overallStart, overallEnd);

  for (const reqDR of requestDateRanges) {
    let currentDate = startOfDay(reqDR.start);
    const dateRangeEndDay = startOfDay(reqDR.end);

    while (isBefore(currentDate, addMinutes(dateRangeEndDay, 1)) || isEqual(currentDate, dateRangeEndDay)) {
      for (const reqTR of requestTimeRanges) {
        // Parse the time string "HH:mm" into a Date object (date part will be today, but we only care for H/M)
        const timeRangeStartDateObj = parseTime(reqTR.start, 'HH:mm', new Date());
        const timeRangeEndDateObj = parseTime(reqTR.end, 'HH:mm', new Date());

        // Use the imported getHours and getMinutes
        const dayTimeSlotStart = setSeconds(setMinutes(setHours(currentDate, getHours(timeRangeStartDateObj)), getMinutes(timeRangeStartDateObj)), 0);
        const dayTimeSlotEnd = setSeconds(setMinutes(setHours(currentDate, getHours(timeRangeEndDateObj)), getMinutes(timeRangeEndDateObj)), 0);
        
        if (isEqual(dayTimeSlotEnd, dayTimeSlotStart) || isBefore(dayTimeSlotEnd, dayTimeSlotStart)) {
            // console.warn(`Skipping invalid time range for day ${format(currentDate, 'yyyy-MM-dd')}: ${reqTR.start} - ${reqTR.end}`);
            continue;
        }

        expandedUserEvents.forEach(event => {
          const eventStart = event.start;
          const eventEnd = event.end;
          const overlaps = isBefore(eventStart, dayTimeSlotEnd) && isAfter(eventEnd, dayTimeSlotStart);

          if (overlaps) {
            const actualStart = isBefore(eventStart, dayTimeSlotStart) ? dayTimeSlotStart : eventStart;
            const actualEnd = isAfter(eventEnd, dayTimeSlotEnd) ? dayTimeSlotEnd : eventEnd;
            
            if (isAfter(actualEnd, actualStart)) {
                 relevantEvents.push({
                    title: event.title,
                    start: actualStart,
                    end: actualEnd,
                });
            }
          }
        });
      }
      currentDate = addMinutes(currentDate, 24 * 60);
    }
  }
  
  const uniqueEventsMap = new Map<string, ParticipantEventClient>();
  relevantEvents.forEach(event => {
    const key = `${event.title}_${event.start.toISOString()}_${event.end.toISOString()}`;
    if (!uniqueEventsMap.has(key)) {
      uniqueEventsMap.set(key, event);
    }
  });

  return Array.from(uniqueEventsMap.values());
};

// ... isParticipantFree function remains the same (it doesn't use getHours/getMinutes directly) ...

// ... findCommonAvailability function remains the same (it also doesn't use getHours/getMinutes directly on Date objects, but on parsed results of split(':')) ...
// However, a line inside findCommonAvailability also uses this pattern:
// let slotPotentialStart = setSeconds(setMinutes(setHours(new Date(currentDay), parseInt(dayStartTimeStr[0])), parseInt(dayStartTimeStr[1])),0);
// This one is FINE because parseInt(dayStartTimeStr[0]) directly gives you the hour number.

const isParticipantFree = (
  participantEvents: ParticipantEventClient[], 
  intervalStart: Date,
  intervalEnd: Date
): boolean => {
  for (const event of participantEvents) { 
    if (isBefore(event.start, intervalEnd) && isAfter(event.end, intervalStart)) {
      return false;
    }
  }
  return true;
};


export const findCommonAvailability = (
  request: HangoutRequestClientState, 
  stepMinutes: number = 15
): CommonSlotClient[] => { 
  const commonSlots: CommonSlotClient[] = [];

  if (!request.participants || Object.keys(request.participants).length === 0 ) {
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
    let currentDay = startOfDay(dr.start); 
    const dateRangeEndDay = startOfDay(dr.end); 

    while (isBefore(currentDay, addMinutes(dateRangeEndDay, 1)) || isEqual(currentDay, dateRangeEndDay)) {
      for (const tr of timeRanges) {
        const dayStartTimeStr = tr.start.split(':');
        const dayEndTimeStr = tr.end.split(':');

        // This part is correct as it uses parseInt on the split string
        let slotPotentialStart = setSeconds(setMinutes(setHours(new Date(currentDay), parseInt(dayStartTimeStr[0])), parseInt(dayStartTimeStr[1])),0);
        const timeRangeEndBoundary = setSeconds(setMinutes(setHours(new Date(currentDay), parseInt(dayEndTimeStr[0])), parseInt(dayEndTimeStr[1])),0);

        while (isBefore(slotPotentialStart, timeRangeEndBoundary)) {
          const actualMeetingStart = addMinutes(slotPotentialStart, desiredMarginMinutes);
          const actualMeetingEnd = addMinutes(actualMeetingStart, desiredDurationMinutes);
          const fullSlotEndWithPostMargin = addMinutes(actualMeetingEnd, desiredMarginMinutes);

          if (isAfter(fullSlotEndWithPostMargin, timeRangeEndBoundary) || isEqual(fullSlotEndWithPostMargin, slotPotentialStart) ) { 
            break;
          }
          if (!isBefore(actualMeetingStart, timeRangeEndBoundary)) {
            break;
          }

          const availableParticipantsForSlot: string[] = [];
          for (const pid of participantIds) {
            const participant = participants[pid]; 
            if (isParticipantFree(participant.events, actualMeetingStart, actualMeetingEnd )) {
              availableParticipantsForSlot.push(pid);
            }
          }

          if (availableParticipantsForSlot.length >= desiredMemberCount) {
            commonSlots.push({
              start: new Date(actualMeetingStart), 
              end: new Date(actualMeetingEnd),     
              availableParticipants: [...availableParticipantsForSlot],
            });
          }
          slotPotentialStart = addMinutes(slotPotentialStart, stepMinutes);
        }
      }
      currentDay = addMinutes(startOfDay(currentDay), 24 * 60);
    }
  }
  return commonSlots.sort((a,b) => a.start.getTime() - b.start.getTime());
};