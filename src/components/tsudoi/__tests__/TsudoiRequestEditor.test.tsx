import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { TsudoiRequestEditor } from '../TsudoiRequestEditor';

vi.mock('@/hooks/useLanguage', () => ({
  useLanguage: () => ({
    t: {
      common: { cancel: 'Cancel' },
      forms: {
        titleRequired: 'Title required',
        requestName: 'Request name',
        desiredMemberCount: 'Desired member count',
      },
      replyPage: { backToList: 'Back to list' },
      hangouts: {},
    },
  }),
}));

describe('TsudoiRequestEditor', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-27T10:30:00'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders a Monday-to-Sunday week view and pages by one week', () => {
    render(
      <TsudoiRequestEditor
        mode="create"
        initialData={{
          weekStartDate: new Date('2026-05-27T10:30:00'),
        }}
        onSave={vi.fn()}
      />,
    );

    expect(screen.getByText('Mon 5/25')).toBeInTheDocument();
    expect(screen.getByText('Sun 5/31')).toBeInTheDocument();
    expect(screen.getByLabelText('Previous week')).toBeInTheDocument();
    expect(screen.getByLabelText('Next week')).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Next week'));

    expect(screen.getByText('Mon 6/1')).toBeInTheDocument();
    expect(screen.getByText('Sun 6/7')).toBeInTheDocument();
  });

  it('opens the visible range modal and can narrow the grid', () => {
    render(
      <TsudoiRequestEditor
        mode="edit"
        initialData={{
          weekStartDate: new Date('2026-05-27T10:30:00'),
          candidateSlotMinutes: 60,
          candidateSlots: [
            {
              start: new Date('2026-05-25T07:00:00'),
              end: new Date('2026-05-25T08:00:00'),
            },
            {
              start: new Date('2026-05-29T20:00:00'),
              end: new Date('2026-05-29T21:00:00'),
            },
          ],
        }}
        onSave={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /07:00 - 21:00/ }));

    expect(screen.getByText('Visible time range')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Show from'), { target: { value: '8' } });
    fireEvent.change(screen.getByLabelText('Show to'), { target: { value: '12' } });
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));

    expect(screen.getByRole('button', { name: 'Select all cells for 08:00' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Select all cells for 11:00' })).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Select all cells for 12:00' }),
    ).not.toBeInTheDocument();
  });

  it('grays out and disables past slots while keeping future slots selectable', () => {
    render(
      <TsudoiRequestEditor
        mode="create"
        initialData={{
          weekStartDate: new Date('2026-05-27T10:30:00'),
        }}
        onSave={vi.fn()}
      />,
    );

    const pastSlot = screen.getByRole('button', { name: 'Mon 5/25 09:00 to 10:00' });
    const futureSlot = screen.getByRole('button', { name: 'Thu 5/28 09:00 to 10:00' });

    expect(pastSlot).toBeDisabled();
    expect(pastSlot.className).toContain('bg-slate-100');
    expect(futureSlot).not.toBeDisabled();
    expect(futureSlot.className).toContain('bg-white');
  });

  it('selects the whole row when the left-most time label is clicked', () => {
    render(
      <TsudoiRequestEditor
        mode="create"
        initialData={{
          weekStartDate: new Date('2026-05-27T10:30:00'),
        }}
        onSave={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Select all cells for 09:00' }));

    expect(screen.getByRole('button', { name: 'Mon 5/25 09:00 to 10:00' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    expect(screen.getByRole('button', { name: 'Tue 5/26 09:00 to 10:00' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    expect(screen.getByRole('button', { name: 'Wed 5/27 09:00 to 10:00' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    expect(screen.getByRole('button', { name: 'Thu 5/28 09:00 to 10:00' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('button', { name: 'Sun 5/31 09:00 to 10:00' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('selects the whole date column when a date header is clicked', () => {
    render(
      <TsudoiRequestEditor
        mode="create"
        initialData={{
          weekStartDate: new Date('2026-05-27T10:30:00'),
        }}
        onSave={vi.fn()}
      />,
    );

    fireEvent.click(
      screen.getByRole('button', { name: 'Select all candidate slots for Thu 5/28' }),
    );

    expect(screen.getByRole('button', { name: 'Thu 5/28 09:00 to 10:00' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('button', { name: 'Thu 5/28 17:00 to 18:00' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('button', { name: 'Fri 5/29 09:00 to 10:00' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('selects and clears every visible future cell with the bulk button', () => {
    render(
      <TsudoiRequestEditor
        mode="create"
        initialData={{
          weekStartDate: new Date('2026-05-27T10:30:00'),
        }}
        onSave={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Select all visible' }));

    expect(screen.getByRole('button', { name: 'Mon 5/25 09:00 to 10:00' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    expect(screen.getByRole('button', { name: 'Thu 5/28 09:00 to 10:00' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('button', { name: 'Sun 5/31 17:00 to 18:00' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    fireEvent.click(screen.getByRole('button', { name: 'Clear all visible' }));

    expect(screen.getByRole('button', { name: 'Thu 5/28 09:00 to 10:00' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('renders 15-minute rows for decimal durations', () => {
    render(
      <TsudoiRequestEditor
        mode="create"
        initialData={{
          weekStartDate: new Date('2026-05-27T10:30:00'),
          candidateSlotMinutes: 30,
          candidateSlots: [
            {
              start: new Date('2026-05-25T00:15:00'),
              end: new Date('2026-05-25T00:45:00'),
            },
          ],
        }}
        onSave={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: 'Select all cells for 00:15' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Mon 5/25 00:15 to 00:45' })).toBeInTheDocument();
  });

  it('keeps hourly start times when the duration exceeds one hour', () => {
    render(
      <TsudoiRequestEditor
        mode="create"
        initialData={{
          weekStartDate: new Date('2026-05-27T10:30:00'),
        }}
        onSave={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByLabelText('Cell duration (hours)'), { target: { value: '3' } });

    expect(screen.getByRole('button', { name: 'Thu 5/28 09:00 to 12:00' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Thu 5/28 10:00 to 13:00' })).toBeInTheDocument();
  });
});
