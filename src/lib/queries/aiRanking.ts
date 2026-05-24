'use client';

import { useMutation } from '@tanstack/react-query';
import { auth } from '@/lib/firebase/config';

export interface RankedSlot {
  index: number;
  rationale: string;
}

interface RankSlotsArgs {
  hangoutName: string;
  durationMinutes: number;
  memberCount: number;
  slots: Array<{ startISO: string; endISO: string; availableParticipants?: string[] }>;
}

interface RankSlotsResponse {
  ranked: RankedSlot[];
}

export function useRankSlots() {
  return useMutation({
    mutationFn: async (args: RankSlotsArgs): Promise<RankSlotsResponse> => {
      const user = auth.currentUser;
      if (!user) throw new Error('Not signed in');
      const token = await user.getIdToken();
      const res = await fetch('/api/hangouts/rank-slots', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(args),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      return (await res.json()) as RankSlotsResponse;
    },
  });
}
