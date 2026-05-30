import { describe, expect, it } from 'vitest';
import {
  candidateSlotKey,
  deriveSlotResponsesFromEvents,
  findCommonAvailability,
  getSlotAttendanceBreakdown,
  prepareCreatorEventsForRequest,
} from '../hangoutUtils';
import { HangoutRequestClientState } from '@/types/hangouts';
import { CalendarEvent } from '@/types/events';

function makeRequest(
  partial: Partial<HangoutRequestClientState> = {},
): HangoutRequestClientState {
  return {
    id: 'req_1',
    creatorUid: 'creator',
    creatorName: 'Creator',
    requestName: 'Test',
    status: 'pending',
    createdAt: new Date('2026-05-18'),
    desiredDurationMinutes: 30,
    desiredMarginMinutes: 0,
    desiredMemberCount: 2,
    dateRanges: [{ start: new Date('2026-05-20T00:00:00'), end: new Date('2026-05-20T23:59:59') }],
    timeRanges: [{ start: '09:00', end: '17:00' }],
    participants: {},
    ...partial,
  };
}

describe('findCommonAvailability', () => {
  it('returns empty when there are no participants', () => {
    const slots = findCommonAvailability(makeRequest());
    expect(slots).toEqual([]);
  });

  it('finds slots when two participants are free all day', () => {
    const slots = findCommonAvailability(
      makeRequest({
        participants: {
          a: { uid: 'a', displayName: 'A', submittedAt: new Date(), events: [] },
          b: { uid: 'b', displayName: 'B', submittedAt: new Date(), events: [] },
        },
      }),
    );
    expect(slots.length).toBeGreaterThan(0);
    expect(slots[0].availableParticipants.sort()).toEqual(['a', 'b']);
  });

  it('excludes a slot blocked by one participant when desiredMemberCount=2', () => {
    const blockedSlotStart = new Date('2026-05-20T10:00:00');
    const blockedSlotEnd = new Date('2026-05-20T10:30:00');
    const slots = findCommonAvailability(
      makeRequest({
        participants: {
          a: {
            uid: 'a',
            displayName: 'A',
            submittedAt: new Date(),
            events: [{ title: 'busy', start: blockedSlotStart, end: blockedSlotEnd }],
          },
          b: { uid: 'b', displayName: 'B', submittedAt: new Date(), events: [] },
        },
      }),
    );
    // The 10:00-10:30 slot should not appear because A is busy then.
    const conflicting = slots.find(
      (s) =>
        s.start.getTime() === blockedSlotStart.getTime() &&
        s.end.getTime() === blockedSlotEnd.getTime(),
    );
    expect(conflicting).toBeUndefined();
  });

  it('respects desiredDurationMinutes', () => {
    const slots = findCommonAvailability(
      makeRequest({
        desiredDurationMinutes: 60,
        participants: {
          a: { uid: 'a', displayName: 'A', submittedAt: new Date(), events: [] },
          b: { uid: 'b', displayName: 'B', submittedAt: new Date(), events: [] },
        },
      }),
    );
    for (const s of slots) {
      expect(s.end.getTime() - s.start.getTime()).toBe(60 * 60_000);
    }
  });

  it('applies desiredMarginMinutes — first slot starts after the margin', () => {
    const slots = findCommonAvailability(
      makeRequest({
        desiredMarginMinutes: 15,
        participants: {
          a: { uid: 'a', displayName: 'A', submittedAt: new Date(), events: [] },
          b: { uid: 'b', displayName: 'B', submittedAt: new Date(), events: [] },
        },
      }),
    );
    expect(slots.length).toBeGreaterThan(0);
    const firstStart = slots[0].start;
    // 09:00 window + 15 min margin → 09:15 is the earliest meeting start
    expect(firstStart.getHours()).toBe(9);
    expect(firstStart.getMinutes()).toBe(15);
  });

  it('requires at least desiredMemberCount participants per slot', () => {
    const blockedSlotStart = new Date('2026-05-20T10:00:00');
    const blockedSlotEnd = new Date('2026-05-20T10:30:00');
    const slots = findCommonAvailability(
      makeRequest({
        desiredMemberCount: 1,
        participants: {
          a: {
            uid: 'a',
            displayName: 'A',
            submittedAt: new Date(),
            events: [{ title: 'busy', start: blockedSlotStart, end: blockedSlotEnd }],
          },
          b: { uid: 'b', displayName: 'B', submittedAt: new Date(), events: [] },
        },
      }),
    );
    // 10:00-10:30 should now appear (B is still free)
    const slot = slots.find(
      (s) =>
        s.start.getTime() === blockedSlotStart.getTime() &&
        s.end.getTime() === blockedSlotEnd.getTime(),
    );
    expect(slot).toBeDefined();
    expect(slot?.availableParticipants).toEqual(['b']);
  });

  it('ranks all-yes response slots above maybe response slots', () => {
    const firstSlot = {
      start: new Date('2026-05-20T10:00:00'),
      end: new Date('2026-05-20T10:30:00'),
    };
    const secondSlot = {
      start: new Date('2026-05-20T11:00:00'),
      end: new Date('2026-05-20T11:30:00'),
    };
    const slots = findCommonAvailability(
      makeRequest({
        desiredMemberCount: 2,
        candidateSlots: [firstSlot, secondSlot],
        participants: {
          a: {
            uid: 'a',
            displayName: 'A',
            submittedAt: new Date(),
            events: [],
            slotResponses: {
              [candidateSlotKey(firstSlot)]: 'maybe',
              [candidateSlotKey(secondSlot)]: 'yes',
            },
          },
          b: {
            uid: 'b',
            displayName: 'B',
            submittedAt: new Date(),
            events: [],
            slotResponses: {
              [candidateSlotKey(firstSlot)]: 'yes',
              [candidateSlotKey(secondSlot)]: 'yes',
            },
          },
        },
      }),
    );

    expect(slots).toHaveLength(2);
    expect(slots[0].yesCount).toBe(2);
    expect(slots[0].maybeCount).toBe(0);
    expect(slots[1].yesCount).toBe(1);
    expect(slots[1].maybeCount).toBe(1);
  });

  it('accepts maybe responses with a penalty when desired member count is met', () => {
    const candidateSlot = {
      start: new Date('2026-05-20T10:00:00'),
      end: new Date('2026-05-20T10:30:00'),
    };
    const slots = findCommonAvailability(
      makeRequest({
        desiredMemberCount: 2,
        candidateSlots: [candidateSlot],
        participants: {
          a: {
            uid: 'a',
            displayName: 'A',
            submittedAt: new Date(),
            events: [],
            slotResponses: {
              [candidateSlotKey(candidateSlot)]: 'maybe',
            },
          },
          b: {
            uid: 'b',
            displayName: 'B',
            submittedAt: new Date(),
            events: [],
            slotResponses: {
              [candidateSlotKey(candidateSlot)]: 'yes',
            },
          },
        },
      }),
    );

    expect(slots).toHaveLength(1);
    expect(slots[0].availableParticipants.sort()).toEqual(['a', 'b']);
    expect(slots[0].maybeParticipants).toEqual(['a']);
  });

  it('allows evaluation when desired member count is not decided', () => {
    const candidateSlot = {
      start: new Date('2026-05-20T10:00:00'),
      end: new Date('2026-05-20T10:30:00'),
    };
    const slots = findCommonAvailability(
      makeRequest({
        desiredMemberCount: 0,
        candidateSlots: [candidateSlot],
        participants: {
          a: {
            uid: 'a',
            displayName: 'A',
            submittedAt: new Date(),
            events: [],
            slotResponses: {
              [candidateSlotKey(candidateSlot)]: 'yes',
            },
          },
        },
      }),
    );

    expect(slots).toHaveLength(1);
    expect(slots[0].yesCount).toBe(1);
  });

  it('keeps candidate slots visible even when only some slots have explicit responses', () => {
    const firstSlot = {
      start: new Date('2026-05-20T10:00:00'),
      end: new Date('2026-05-20T10:30:00'),
    };
    const secondSlot = {
      start: new Date('2026-05-20T11:00:00'),
      end: new Date('2026-05-20T11:30:00'),
    };
    const slots = findCommonAvailability(
      makeRequest({
        desiredMemberCount: 2,
        candidateSlots: [firstSlot, secondSlot],
        participants: {
          a: {
            uid: 'a',
            displayName: 'A',
            submittedAt: new Date(),
            events: [],
            slotResponses: {
              [candidateSlotKey(firstSlot)]: 'yes',
            },
          },
          b: {
            uid: 'b',
            displayName: 'B',
            submittedAt: new Date(),
            events: [],
          },
        },
      }),
    );

    expect(slots).toHaveLength(2);
    expect(slots[0].availableParticipants.sort()).toEqual(['a', 'b']);
    expect(slots[1].availableParticipants.sort()).toEqual(['a', 'b']);
  });

  it('prefills slot responses from busy calendar overlaps', () => {
    const firstSlot = {
      start: new Date('2026-05-20T10:00:00'),
      end: new Date('2026-05-20T10:30:00'),
    };
    const secondSlot = {
      start: new Date('2026-05-20T11:00:00'),
      end: new Date('2026-05-20T11:30:00'),
    };
    const responses = deriveSlotResponsesFromEvents(
      [firstSlot, secondSlot],
      [{ title: 'Busy', start: new Date('2026-05-20T10:10:00'), end: new Date('2026-05-20T10:20:00') }],
    );

    expect(responses[candidateSlotKey(firstSlot)]).toBe('no');
    expect(responses[candidateSlotKey(secondSlot)]).toBe('yes');
  });

  it('builds a per-participant attendance breakdown for a slot', () => {
    const slot = {
      start: new Date('2026-05-20T10:00:00'),
      end: new Date('2026-05-20T10:30:00'),
    };
    const breakdown = getSlotAttendanceBreakdown(slot, {
      a: {
        uid: 'a',
        displayName: 'A',
        submittedAt: new Date(),
        events: [],
        slotResponses: {
          [candidateSlotKey(slot)]: 'maybe',
        },
      },
      b: {
        uid: 'b',
        displayName: 'B',
        submittedAt: new Date(),
        events: [{ title: 'busy', start: new Date('2026-05-20T10:05:00'), end: new Date('2026-05-20T10:20:00') }],
      },
      c: {
        uid: 'c',
        displayName: 'C',
        submittedAt: new Date(),
        events: [],
      },
    });

    expect(breakdown.maybeParticipants.map((participant) => participant.uid)).toEqual(['a']);
    expect(breakdown.noParticipants.map((participant) => participant.uid)).toEqual(['b']);
    expect(breakdown.yesParticipants.map((participant) => participant.uid)).toEqual(['c']);
    expect(breakdown.availableParticipants.sort()).toEqual(['a', 'c']);
    expect(breakdown.yesCount).toBe(1);
    expect(breakdown.maybeCount).toBe(1);
    expect(breakdown.noCount).toBe(1);
  });
});

describe('prepareCreatorEventsForRequest', () => {
  it('returns empty array for empty input', () => {
    expect(
      prepareCreatorEventsForRequest(
        [],
        [{ start: new Date('2026-05-20'), end: new Date('2026-05-20') }],
        [{ start: '09:00', end: '17:00' }],
      ),
    ).toEqual([]);
  });

  it('includes a busy event that overlaps the request window', () => {
    const events: CalendarEvent[] = [
      {
        id: 'e1',
        title: 'Meeting',
        start: new Date('2026-05-20T10:00:00'),
        end: new Date('2026-05-20T11:00:00'),
      },
    ];
    const result = prepareCreatorEventsForRequest(
      events,
      [{ start: new Date('2026-05-20T00:00:00'), end: new Date('2026-05-20T23:59:59') }],
      [{ start: '09:00', end: '17:00' }],
    );
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('Meeting');
  });

  it('excludes events outside the request date range', () => {
    const events: CalendarEvent[] = [
      {
        id: 'e1',
        title: 'Far future',
        start: new Date('2026-07-01T10:00:00'),
        end: new Date('2026-07-01T11:00:00'),
      },
    ];
    const result = prepareCreatorEventsForRequest(
      events,
      [{ start: new Date('2026-05-20T00:00:00'), end: new Date('2026-05-20T23:59:59') }],
      [{ start: '09:00', end: '17:00' }],
    );
    expect(result).toEqual([]);
  });

  it('clips a busy event to the daily time range', () => {
    const events: CalendarEvent[] = [
      {
        id: 'e1',
        title: 'Long meeting',
        start: new Date('2026-05-20T08:00:00'),
        end: new Date('2026-05-20T18:00:00'),
      },
    ];
    const result = prepareCreatorEventsForRequest(
      events,
      [{ start: new Date('2026-05-20T00:00:00'), end: new Date('2026-05-20T23:59:59') }],
      [{ start: '09:00', end: '17:00' }],
    );
    expect(result).toHaveLength(1);
    expect(result[0].start.getHours()).toBe(9);
    expect(result[0].end.getHours()).toBe(17);
  });

  it("drops instances whose stamp is stampAvailability='free'", () => {
    const events: CalendarEvent[] = [
      {
        id: 'stamp-free',
        title: 'Available for lunch',
        start: new Date('2026-05-20T12:00:00'),
        end: new Date('2026-05-20T13:00:00'),
        isStamp: true,
        stampAvailability: 'free',
      },
      {
        id: 'inst-free',
        title: 'Available for lunch',
        start: new Date('2026-05-20T12:00:00'),
        end: new Date('2026-05-20T13:00:00'),
        isStamp: true,
        originalStampId: 'stamp-free',
      },
    ];
    const result = prepareCreatorEventsForRequest(
      events,
      [{ start: new Date('2026-05-20T00:00:00'), end: new Date('2026-05-20T23:59:59') }],
      [{ start: '09:00', end: '17:00' }],
    );
    expect(result).toEqual([]);
  });

  it("flags instances whose stamp is stampAvailability='tentative' with tentative=true", () => {
    const events: CalendarEvent[] = [
      {
        id: 'stamp-t',
        title: 'Maybe deep work',
        start: new Date('2026-05-20T10:00:00'),
        end: new Date('2026-05-20T11:00:00'),
        isStamp: true,
        stampAvailability: 'tentative',
      },
      {
        id: 'inst-t',
        title: 'Maybe deep work',
        start: new Date('2026-05-20T10:00:00'),
        end: new Date('2026-05-20T11:00:00'),
        isStamp: true,
        originalStampId: 'stamp-t',
      },
    ];
    const result = prepareCreatorEventsForRequest(
      events,
      [{ start: new Date('2026-05-20T00:00:00'), end: new Date('2026-05-20T23:59:59') }],
      [{ start: '09:00', end: '17:00' }],
    );
    expect(result).toHaveLength(1);
    expect(result[0].tentative).toBe(true);
  });
});
