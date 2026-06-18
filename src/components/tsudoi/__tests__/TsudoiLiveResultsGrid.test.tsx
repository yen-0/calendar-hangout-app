import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { candidateSlotKey } from '@/utils/hangoutUtils';
import { TsudoiLiveResultsGrid } from '../TsudoiLiveResultsGrid';

vi.mock('@/hooks/useLanguage', () => ({
  useLanguage: () => ({
    language: 'en',
    t: {
      common: { close: 'Close' },
    },
  }),
}));

const slot = {
  start: new Date('2026-05-28T09:00:00'),
  end: new Date('2026-05-28T10:00:00'),
};

const participants = {
  alice: {
    uid: 'alice',
    displayName: 'Alice',
    submittedAt: new Date('2026-05-27T10:00:00'),
    events: [],
    slotResponses: { [candidateSlotKey(slot)]: 'yes' },
  },
  ben: {
    uid: 'ben',
    displayName: 'Ben',
    submittedAt: new Date('2026-05-27T10:05:00'),
    events: [],
    slotResponses: { [candidateSlotKey(slot)]: 'maybe' },
  },
  chika: {
    uid: 'chika',
    displayName: 'Chika',
    submittedAt: new Date('2026-05-27T10:10:00'),
    events: [],
    slotResponses: { [candidateSlotKey(slot)]: 'no' },
  },
};

describe('TsudoiLiveResultsGrid', () => {
  it('opens participant response details when a result cell is clicked', () => {
    render(
      <TsudoiLiveResultsGrid
        candidateSlots={[slot]}
        commonSlots={[]}
        participants={participants}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /View responses for Thu, May 28 09:00/ }));

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Response details')).toBeInTheDocument();
    expect(screen.getByText('○ Circle')).toBeInTheDocument();
    expect(screen.getByText('△ Triangle')).toBeInTheDocument();
    expect(screen.getByText('× Cross')).toBeInTheDocument();
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Ben')).toBeInTheDocument();
    expect(screen.getByText('Chika')).toBeInTheDocument();
  });

  it('keeps confirmation behind the details modal for selectable viable slots', () => {
    const handleSelect = vi.fn();

    render(
      <TsudoiLiveResultsGrid
        candidateSlots={[slot]}
        commonSlots={[{ ...slot, availableParticipants: ['alice', 'ben'] }]}
        participants={participants}
        canSelect
        onSelectCommonSlot={handleSelect}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /View responses for Thu, May 28 09:00/ }));
    expect(handleSelect).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Confirm this slot' }));
    expect(handleSelect).toHaveBeenCalledWith(0);
  });
});
