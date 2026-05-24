import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { axe } from 'jest-axe';
import { StampPalette } from '../StampPalette';
import { CalendarEvent } from '@/types/events';

// Asserting directly on .violations sidesteps the jest-axe / vitest matcher type mismatch.
const noop = () => {};

describe('StampPalette a11y', () => {
  it('has no detectable a11y violations when empty', async () => {
    const { container } = render(
      <StampPalette
        stamps={[]}
        selectedStamp={null}
        onSelect={noop}
        onEdit={noop}
        onNewStamp={noop}
      />,
    );
    const results = await axe(container);
    expect(results.violations).toEqual([]);
  });

  it('has no detectable a11y violations with stamps', async () => {
    const stamps: CalendarEvent[] = [
      {
        id: 's1',
        title: 'Gym',
        start: new Date('2026-05-22T07:00:00'),
        end: new Date('2026-05-22T08:00:00'),
        isStamp: true,
        emoji: '🏋️',
        color: '#16a34a',
        repeatDays: ['MON', 'WED', 'FRI'],
        repeatEndDate: new Date('2026-12-31T00:00:00'),
      },
    ];
    const { container } = render(
      <StampPalette
        stamps={stamps}
        selectedStamp={null}
        onSelect={noop}
        onEdit={noop}
        onNewStamp={noop}
      />,
    );
    const results = await axe(container);
    expect(results.violations).toEqual([]);
  });
});
