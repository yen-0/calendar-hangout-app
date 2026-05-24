'use client';

import { useCallback, useState } from 'react';
import { View, Views } from 'react-big-calendar';
import { addDays, endOfDay, endOfWeek, startOfDay, startOfWeek } from 'date-fns';

export interface ViewWindow {
  start: Date;
  end: Date;
}

function computeViewWindow(date: Date, view: View): ViewWindow {
  let start = new Date(date);
  let end = new Date(date);
  if (view === 'month') {
    start = new Date(start.getFullYear(), start.getMonth(), 1);
    end = new Date(end.getFullYear(), end.getMonth() + 1, 0);
    start = addDays(start, -7);
    end = addDays(end, 7);
  } else if (view === 'week') {
    start = startOfWeek(start, { weekStartsOn: 0 });
    end = endOfWeek(end, { weekStartsOn: 0 });
  } else if (view === 'day') {
    start = startOfDay(start);
    end = endOfDay(end);
  }
  return { start, end };
}

export function useCalendarView(initialView: View = 'month') {
  const [view, setView] = useState<View>(initialView);
  const [date, setDate] = useState<Date>(() => new Date());
  const [viewWindow, setViewWindow] = useState<ViewWindow>(() =>
    computeViewWindow(new Date(), initialView),
  );

  const handleNavigate = useCallback((next: Date, nextView: View) => {
    setDate(next);
    setViewWindow(computeViewWindow(next, nextView));
  }, []);

  const handleViewChange = useCallback(
    (next: View) => {
      setView(next);
      setViewWindow(computeViewWindow(date, next));
    },
    [date],
  );

  const handleRangeChange = useCallback(
    (range: Date[] | { start: Date; end: Date }) => {
      let start: Date;
      let end: Date;
      if (Array.isArray(range)) {
        if (range.length === 0) return;
        start = startOfDay(range[0]);
        end = endOfDay(range[range.length - 1]);
      } else {
        start = startOfDay(range.start);
        end = endOfDay(range.end);
      }
      if (view === Views.MONTH) {
        start = addDays(start, -7);
        end = addDays(end, 7);
      }
      setViewWindow({ start, end });
    },
    [view],
  );

  return { view, date, viewWindow, handleNavigate, handleViewChange, handleRangeChange };
}
