// src/utils/hangoutUtils.ts
import { CalendarEvent, StampAvailability } from '@/types/events';
import {
  DateRangeClient,
  TimeRange,
  ParticipantEventClient,
  ParticipantDataClient,
  HangoutRequestClientState,
  CommonSlotClient,
  CandidateSlotClient,
  SlotResponseStatus,
} from '@/types/hangouts';
import { expandRecurringEvents } from './eventUtils';

export function getHangoutStatusLabel(
  status: HangoutRequestClientState['status'],
): 'Open' | 'Confirmed' | 'Closed' {
  if (status === 'confirmed') return 'Confirmed';
  if (status === 'closed') return 'Closed';
  return 'Open';
}

/**
 * For an event in the user's calendar, resolve the stampAvailability of its
 * source stamp (if any). Returns:
 *  - 'busy' for non-stamp events and stamps with no/explicit busy setting.
 *  - 'free' for events whose source stamp is marked stampAvailability='free'.
 *    These should be SKIPPED entirely when computing availability.
 *  - 'tentative' for events whose source stamp is 'tentative'. These still
 *    block, but get flagged so future scoring can downweight overlap.
 */
const resolveAvailability = (
  event: CalendarEvent,
  masterStampsById: Map<string, CalendarEvent>,
): StampAvailability => {
  if (event.originalStampId) {
    const master = masterStampsById.get(event.originalStampId);
    if (master?.stampAvailability) return master.stampAvailability;
  }
  if (event.isStamp && event.stampAvailability) return event.stampAvailability;
  return 'busy';
};
import {
  differenceInMinutes,
  setHours,
  setMinutes,
  setSeconds,
  parse as parseTime,
  startOfDay,
  addMinutes,
  isBefore,
  isAfter,
  isEqual,
  getHours,
  getMinutes,
} from 'date-fns';
import {
  getTsudoiCellKey,
  getTsudoiGridStepMinutes,
  getTsudoiRowIndexFromMinutes,
} from './tsudoiGridUtils';

// ... (rest of the imports and interfaces if any locally defined)

export const prepareCreatorEventsForRequest = (
  userEvents: CalendarEvent[],
  requestDateRanges: DateRangeClient[],
  requestTimeRanges: TimeRange[],
  requestCandidateSlots: CandidateSlotClient[] = [],
): ParticipantEventClient[] => {
  const relevantEvents: ParticipantEventClient[] = [];

  if (!userEvents || userEvents.length === 0) return [];

  if (requestCandidateSlots.length > 0) {
    const masterStampsById = new Map<string, CalendarEvent>();
    for (const e of userEvents) {
      if (e.isStamp && !e.originalStampId) masterStampsById.set(e.id, e);
    }

    for (const slot of requestCandidateSlots) {
      for (const event of expandRecurringEvents(userEvents, slot.start, slot.end)) {
        const availability = resolveAvailability(event, masterStampsById);
        if (availability === 'free') continue;

        const eventStart = event.start;
        const eventEnd = event.end;
        const overlaps = isBefore(eventStart, slot.end) && isAfter(eventEnd, slot.start);

        if (overlaps) {
          const actualStart = isBefore(eventStart, slot.start) ? slot.start : eventStart;
          const actualEnd = isAfter(eventEnd, slot.end) ? slot.end : eventEnd;

          if (isAfter(actualEnd, actualStart)) {
            relevantEvents.push({
              title: event.title,
              start: actualStart,
              end: actualEnd,
              ...(availability === 'tentative' ? { tentative: true } : {}),
            });
          }
        }
      }
    }

    const uniqueEventsMap = new Map<string, ParticipantEventClient>();
    relevantEvents.forEach((event) => {
      const key = `${event.title}_${event.start.toISOString()}_${event.end.toISOString()}`;
      if (!uniqueEventsMap.has(key)) {
        uniqueEventsMap.set(key, event);
      }
    });

    return Array.from(uniqueEventsMap.values());
  }

  let overallStart = requestDateRanges[0]?.start;
  let overallEnd = requestDateRanges[0]?.end;

  requestDateRanges.forEach((dr) => {
    if (isBefore(dr.start, overallStart)) overallStart = dr.start;
    if (isAfter(dr.end, overallEnd)) overallEnd = dr.end;
  });

  if (!overallStart || !overallEnd) return [];

  // Build a lookup so stamp instances can resolve their availability via their
  // originating definition (which holds stampAvailability, not the instance).
  const masterStampsById = new Map<string, CalendarEvent>();
  for (const e of userEvents) {
    if (e.isStamp && !e.originalStampId) masterStampsById.set(e.id, e);
  }

  const expandedUserEvents = expandRecurringEvents(userEvents, overallStart, overallEnd);

  for (const reqDR of requestDateRanges) {
    let currentDate = startOfDay(reqDR.start);
    const dateRangeEndDay = startOfDay(reqDR.end);

    while (
      isBefore(currentDate, addMinutes(dateRangeEndDay, 1)) ||
      isEqual(currentDate, dateRangeEndDay)
    ) {
      for (const reqTR of requestTimeRanges) {
        // Parse the time string "HH:mm" into a Date object (date part will be today, but we only care for H/M)
        const timeRangeStartDateObj = parseTime(reqTR.start, 'HH:mm', new Date());
        const timeRangeEndDateObj = parseTime(reqTR.end, 'HH:mm', new Date());

        // Use the imported getHours and getMinutes
        const dayTimeSlotStart = setSeconds(
          setMinutes(
            setHours(currentDate, getHours(timeRangeStartDateObj)),
            getMinutes(timeRangeStartDateObj),
          ),
          0,
        );
        const dayTimeSlotEnd = setSeconds(
          setMinutes(
            setHours(currentDate, getHours(timeRangeEndDateObj)),
            getMinutes(timeRangeEndDateObj),
          ),
          0,
        );

        if (
          isEqual(dayTimeSlotEnd, dayTimeSlotStart) ||
          isBefore(dayTimeSlotEnd, dayTimeSlotStart)
        ) {
          // console.warn(`Skipping invalid time range for day ${format(currentDate, 'yyyy-MM-dd')}: ${reqTR.start} - ${reqTR.end}`);
          continue;
        }

        expandedUserEvents.forEach((event) => {
          const availability = resolveAvailability(event, masterStampsById);
          if (availability === 'free') return; // explicitly available; do not block

          const eventStart = event.start;
          const eventEnd = event.end;
          const overlaps =
            isBefore(eventStart, dayTimeSlotEnd) && isAfter(eventEnd, dayTimeSlotStart);

          if (overlaps) {
            const actualStart = isBefore(eventStart, dayTimeSlotStart)
              ? dayTimeSlotStart
              : eventStart;
            const actualEnd = isAfter(eventEnd, dayTimeSlotEnd) ? dayTimeSlotEnd : eventEnd;

            if (isAfter(actualEnd, actualStart)) {
              relevantEvents.push({
                title: event.title,
                start: actualStart,
                end: actualEnd,
                ...(availability === 'tentative' ? { tentative: true } : {}),
              });
            }
          }
        });
      }
      currentDate = addMinutes(currentDate, 24 * 60);
    }
  }

  const uniqueEventsMap = new Map<string, ParticipantEventClient>();
  relevantEvents.forEach((event) => {
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
  intervalEnd: Date,
): boolean => {
  for (const event of participantEvents) {
    if (isBefore(event.start, intervalEnd) && isAfter(event.end, intervalStart)) {
      // TODO(stamp-availability scoring): tentative events currently block like
      // busy ones. A future pass should let them through here and emit a
      // confidence/score on the resulting CommonSlotClient so downstream UI
      // can warn rather than hide.
      return false;
    }
  }
  return true;
};

export function candidateSlotKey(slot: CandidateSlotClient): string {
  return `${new Date(slot.start).toISOString()}_${new Date(slot.end).toISOString()}`;
}

function legacyTsudoiCellResponseKey(slot: CandidateSlotClient): string {
  const durationMinutes = Math.max(15, differenceInMinutes(slot.end, slot.start));
  const stepMinutes = getTsudoiGridStepMinutes(durationMinutes);
  const minutesFromMidnight = slot.start.getHours() * 60 + slot.start.getMinutes();
  const rowIndex = getTsudoiRowIndexFromMinutes(minutesFromMidnight, stepMinutes);
  return getTsudoiCellKey(slot.start, rowIndex);
}

export function deriveSlotResponsesFromEvents(
  candidateSlots: CandidateSlotClient[],
  participantEvents: ParticipantEventClient[],
): Record<string, SlotResponseStatus> {
  return Object.fromEntries(
    candidateSlots.map((slot) => [
      candidateSlotKey(slot),
      isParticipantFree(participantEvents, slot.start, slot.end) ? 'yes' : 'no',
    ]),
  );
}

export interface SlotAttendanceParticipant {
  uid: string;
  displayName: string;
  status: SlotResponseStatus;
}

export interface SlotAttendanceBreakdown {
  participants: SlotAttendanceParticipant[];
  yesParticipants: SlotAttendanceParticipant[];
  maybeParticipants: SlotAttendanceParticipant[];
  noParticipants: SlotAttendanceParticipant[];
  availableParticipants: string[];
  yesCount: number;
  maybeCount: number;
  noCount: number;
}

export function getParticipantAttendanceStatus(
  slot: CandidateSlotClient,
  participant: ParticipantDataClient,
): SlotResponseStatus {
  const key = candidateSlotKey(slot);
  const legacyKey = legacyTsudoiCellResponseKey(slot);
  return (
    participant.slotResponses?.[key] ??
    participant.slotResponses?.[legacyKey] ??
    (isParticipantFree(participant.events, slot.start, slot.end) ? 'yes' : 'no')
  );
}

export function getSlotAttendanceBreakdown(
  slot: CandidateSlotClient,
  participants: HangoutRequestClientState['participants'],
): SlotAttendanceBreakdown {
  const participantsList = Object.values(participants).map((participant) => ({
    uid: participant.uid,
    displayName: participant.displayName,
    status: getParticipantAttendanceStatus(slot, participant),
  }));

  const yesParticipants = participantsList.filter((participant) => participant.status === 'yes');
  const maybeParticipants = participantsList.filter(
    (participant) => participant.status === 'maybe',
  );
  const noParticipants = participantsList.filter((participant) => participant.status === 'no');

  return {
    participants: participantsList,
    yesParticipants,
    maybeParticipants,
    noParticipants,
    availableParticipants: [...yesParticipants, ...maybeParticipants].map(
      (participant) => participant.uid,
    ),
    yesCount: yesParticipants.length,
    maybeCount: maybeParticipants.length,
    noCount: noParticipants.length,
  };
}

function scoreCandidateSlotFromResponses(
  slot: CandidateSlotClient,
  participants: HangoutRequestClientState['participants'],
  desiredMemberCount: number,
): CommonSlotClient | null {
  const breakdown = getSlotAttendanceBreakdown(slot, participants);

  const minimumViableCount = desiredMemberCount > 0 ? desiredMemberCount : 1;
  const viableCount = breakdown.yesCount + breakdown.maybeCount;
  if (viableCount < minimumViableCount) return null;

  return {
    start: new Date(slot.start),
    end: new Date(slot.end),
    availableParticipants: breakdown.availableParticipants,
    maybeParticipants: breakdown.maybeParticipants.map((participant) => participant.uid),
    unavailableParticipants: breakdown.noParticipants.map((participant) => participant.uid),
    yesCount: breakdown.yesCount,
    maybeCount: breakdown.maybeCount,
    noCount: breakdown.noCount,
    score: breakdown.yesCount * 100 - breakdown.maybeCount * 10 - breakdown.noCount,
  };
}

export const findCommonAvailability = (
  request: HangoutRequestClientState,
  stepMinutes: number = 15,
): CommonSlotClient[] => {
  const commonSlots: CommonSlotClient[] = [];

  if (!request.participants || Object.keys(request.participants).length === 0) {
    return [];
  }

  const {
    dateRanges,
    timeRanges,
    candidateSlots,
    desiredDurationMinutes,
    desiredMarginMinutes,
    desiredMemberCount,
    participants,
  } = request;

  const participantIds = Object.keys(participants);
  const minimumViableCount = desiredMemberCount > 0 ? desiredMemberCount : 1;

  if (candidateSlots && candidateSlots.length > 0) {
    const responseScoredSlots = candidateSlots
      .map((slot) => scoreCandidateSlotFromResponses(slot, participants, minimumViableCount))
      .filter((slot): slot is CommonSlotClient => !!slot);

    if (responseScoredSlots.length > 0) {
      return responseScoredSlots.sort((a, b) => {
        const scoreDelta = (b.score ?? 0) - (a.score ?? 0);
        if (scoreDelta !== 0) return scoreDelta;
        const yesDelta = (b.yesCount ?? 0) - (a.yesCount ?? 0);
        if (yesDelta !== 0) return yesDelta;
        const maybeDelta = (a.maybeCount ?? 0) - (b.maybeCount ?? 0);
        if (maybeDelta !== 0) return maybeDelta;
        return a.start.getTime() - b.start.getTime();
      });
    }

    for (const slot of candidateSlots) {
      const availableParticipantsForSlot: string[] = [];
      for (const pid of participantIds) {
        const participant = participants[pid];
        if (isParticipantFree(participant.events, slot.start, slot.end)) {
          availableParticipantsForSlot.push(pid);
        }
      }

      if (availableParticipantsForSlot.length >= minimumViableCount) {
        commonSlots.push({
          start: new Date(slot.start),
          end: new Date(slot.end),
          availableParticipants: [...availableParticipantsForSlot],
        });
      }
    }

    return commonSlots.sort((a, b) => a.start.getTime() - b.start.getTime());
  }

  for (const dr of dateRanges) {
    let currentDay = startOfDay(dr.start);
    const dateRangeEndDay = startOfDay(dr.end);

    while (
      isBefore(currentDay, addMinutes(dateRangeEndDay, 1)) ||
      isEqual(currentDay, dateRangeEndDay)
    ) {
      for (const tr of timeRanges) {
        const dayStartTimeStr = tr.start.split(':');
        const dayEndTimeStr = tr.end.split(':');

        // This part is correct as it uses parseInt on the split string
        let slotPotentialStart = setSeconds(
          setMinutes(
            setHours(new Date(currentDay), parseInt(dayStartTimeStr[0])),
            parseInt(dayStartTimeStr[1]),
          ),
          0,
        );
        const timeRangeEndBoundary = setSeconds(
          setMinutes(
            setHours(new Date(currentDay), parseInt(dayEndTimeStr[0])),
            parseInt(dayEndTimeStr[1]),
          ),
          0,
        );

        while (isBefore(slotPotentialStart, timeRangeEndBoundary)) {
          const actualMeetingStart = addMinutes(slotPotentialStart, desiredMarginMinutes);
          const actualMeetingEnd = addMinutes(actualMeetingStart, desiredDurationMinutes);
          const fullSlotEndWithPostMargin = addMinutes(actualMeetingEnd, desiredMarginMinutes);

          if (
            isAfter(fullSlotEndWithPostMargin, timeRangeEndBoundary) ||
            isEqual(fullSlotEndWithPostMargin, slotPotentialStart)
          ) {
            break;
          }
          if (!isBefore(actualMeetingStart, timeRangeEndBoundary)) {
            break;
          }

          const availableParticipantsForSlot: string[] = [];
          for (const pid of participantIds) {
            const participant = participants[pid];
            if (isParticipantFree(participant.events, actualMeetingStart, actualMeetingEnd)) {
              availableParticipantsForSlot.push(pid);
            }
          }

          if (availableParticipantsForSlot.length >= minimumViableCount) {
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
  return commonSlots.sort((a, b) => a.start.getTime() - b.start.getTime());
};
