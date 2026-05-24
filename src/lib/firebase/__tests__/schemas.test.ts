import { describe, expect, it } from 'vitest';
import { CalendarEventSchema, TimeRangeSchema, DateRangeClientSchema } from '../schemas';

describe('CalendarEventSchema', () => {
  it('accepts a minimal local event', () => {
    const event = CalendarEventSchema.parse({
      id: 'evt_1',
      title: 'Lunch',
      start: new Date('2026-05-21T12:00:00Z'),
      end: new Date('2026-05-21T13:00:00Z'),
    });
    expect(event.id).toBe('evt_1');
    expect(event.source).toBeUndefined();
  });

  it('accepts a stamp event with repeat config', () => {
    const event = CalendarEventSchema.parse({
      id: 'stamp_gym',
      title: 'Gym',
      start: new Date('2026-05-21T07:00:00Z'),
      end: new Date('2026-05-21T08:00:00Z'),
      isStamp: true,
      emoji: '💪',
      repeatDays: ['MON', 'WED', 'FRI'],
      repeatEndDate: new Date('2026-12-31T00:00:00Z'),
      color: '#ff0000',
    });
    expect(event.isStamp).toBe(true);
    expect(event.repeatDays).toEqual(['MON', 'WED', 'FRI']);
  });

  it('accepts a gcal-sourced event with gcalEventId', () => {
    const event = CalendarEventSchema.parse({
      id: 'gcal_abc',
      title: 'Standup',
      start: new Date('2026-05-21T09:00:00Z'),
      end: new Date('2026-05-21T09:15:00Z'),
      source: 'gcal',
      gcalEventId: 'abc123def456',
    });
    expect(event.source).toBe('gcal');
    expect(event.gcalEventId).toBe('abc123def456');
  });

  it('rejects missing id', () => {
    expect(() =>
      CalendarEventSchema.parse({ title: 'x', start: new Date(), end: new Date() }),
    ).toThrow();
  });

  it('rejects a non-Date start', () => {
    expect(() =>
      CalendarEventSchema.parse({
        id: 'a',
        title: 'x',
        start: '2026-05-21',
        end: new Date(),
      }),
    ).toThrow();
  });

  it('rejects an invalid day key in repeatDays', () => {
    expect(() =>
      CalendarEventSchema.parse({
        id: 'a',
        title: 'x',
        start: new Date(),
        end: new Date(),
        repeatDays: ['MONDAY'],
      }),
    ).toThrow();
  });
});

describe('TimeRangeSchema', () => {
  it('accepts HH:mm strings', () => {
    expect(TimeRangeSchema.parse({ start: '09:00', end: '17:30' })).toEqual({
      start: '09:00',
      end: '17:30',
    });
  });

  it('rejects malformed times', () => {
    expect(() => TimeRangeSchema.parse({ start: '9:00', end: '17:30' })).toThrow();
    expect(() => TimeRangeSchema.parse({ start: '09:00:00', end: '17:30' })).toThrow();
  });
});

describe('DateRangeClientSchema', () => {
  it('accepts a pair of Dates', () => {
    const range = DateRangeClientSchema.parse({
      start: new Date('2026-05-21'),
      end: new Date('2026-05-22'),
    });
    expect(range.start).toBeInstanceOf(Date);
  });
});
