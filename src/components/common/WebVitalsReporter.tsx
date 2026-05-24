'use client';

import { useReportWebVitals } from 'next/web-vitals';

/**
 * Reports Core Web Vitals (LCP, FID, CLS, INP, TTFB, FCP).
 * In production, POSTs to /api/vitals (best-effort, non-blocking).
 * In development, logs to the console for quick inspection.
 */
export function WebVitalsReporter() {
  useReportWebVitals((metric) => {
    if (process.env.NODE_ENV !== 'production') {
      // eslint-disable-next-line no-console
      console.log('[web-vital]', metric.name, Math.round(metric.value), metric.rating);
      return;
    }
    const body = JSON.stringify({
      name: metric.name,
      value: metric.value,
      rating: metric.rating,
      id: metric.id,
      delta: metric.delta,
      navigationType: metric.navigationType,
    });
    // Use sendBeacon when available for reliability during page unload.
    if (typeof navigator !== 'undefined' && 'sendBeacon' in navigator) {
      navigator.sendBeacon('/api/vitals', body);
    } else {
      fetch('/api/vitals', { method: 'POST', body, keepalive: true }).catch(() => {});
    }
  });
  return null;
}
