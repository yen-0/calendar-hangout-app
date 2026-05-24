export const queryKeys = {
  calendarItems: (userId: string | undefined) => ['calendarItems', userId] as const,
  hangoutRequests: {
    all: ['hangoutRequests'] as const,
    list: (userId: string | undefined) => ['hangoutRequests', 'list', userId] as const,
    detail: (id: string) => ['hangoutRequests', 'detail', id] as const,
  },
} as const;
