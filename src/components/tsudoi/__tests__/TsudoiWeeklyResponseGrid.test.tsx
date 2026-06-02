import { useState } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { TsudoiWeeklyResponseGrid } from '../TsudoiWeeklyResponseGrid';

function ResponseHarness() {
  const [responses, setResponses] = useState<Record<string, 'yes' | 'maybe' | 'no'>>({});

  return (
    <TsudoiWeeklyResponseGrid
      candidateSlots={[
        {
          start: new Date('2026-05-28T09:00:00'),
          end: new Date('2026-05-28T10:00:00'),
        },
        {
          start: new Date('2026-05-28T11:00:00'),
          end: new Date('2026-05-28T12:00:00'),
        },
      ]}
      responses={responses}
      onChange={setResponses}
    />
  );
}

describe('TsudoiWeeklyResponseGrid', () => {
  it('cycles through the response states for a candidate cell', () => {
    render(<ResponseHarness />);

    expect(screen.getByRole('button', { name: /09:00 - 18:00/ })).toBeInTheDocument();

    const cell = screen.getByRole('button', { name: /Thu, May 28 09:00/ });
    const initialMark = cell.textContent;

    fireEvent.click(cell);
    expect(screen.getByRole('button', { name: /Thu, May 28 09:00/ }).textContent).not.toBe(
      initialMark,
    );

    fireEvent.click(screen.getByRole('button', { name: /Thu, May 28 09:00/ }));
    expect(screen.getByRole('button', { name: /Thu, May 28 09:00/ }).textContent).not.toBe(
      initialMark,
    );

    fireEvent.click(screen.getByRole('button', { name: /Thu, May 28 09:00/ }));
    expect(screen.getByRole('button', { name: /Thu, May 28 09:00/ }).textContent).toBe(initialMark);
  });

  it('selects all candidate slots for a day when the day header is clicked', async () => {
    const user = userEvent.setup();
    render(<ResponseHarness />);

    const firstCell = screen.getByRole('button', { name: /Thu, May 28 09:00/ });
    const secondCell = screen.getByRole('button', { name: /Thu, May 28 11:00/ });
    const dayHeader = screen.getByRole('button', { name: /Thu 5\/28/ });
    const firstInitialMark = firstCell.textContent;
    const secondInitialMark = secondCell.textContent;

    await user.click(firstCell);
    await user.click(firstCell);
    await user.click(secondCell);

    expect(screen.getByRole('button', { name: /Thu, May 28 09:00/ }).textContent).not.toBe(
      firstInitialMark,
    );
    expect(screen.getByRole('button', { name: /Thu, May 28 11:00/ }).textContent).not.toBe(
      secondInitialMark,
    );

    await user.click(dayHeader);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Thu, May 28 09:00/ }).textContent).toBe(
        firstInitialMark,
      );
      expect(screen.getByRole('button', { name: /Thu, May 28 11:00/ }).textContent).toBe(
        secondInitialMark,
      );
    });
  });
});
