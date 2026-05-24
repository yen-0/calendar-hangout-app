'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import type { EventLocation } from '@/types/events';
import type { LocationSearchResponse, LocationSearchResult } from '@/lib/location/types';

interface Props {
  value: EventLocation | undefined;
  onChange: (next: EventLocation | undefined) => void;
  /** Form input id — used by the <label htmlFor> in the parent form. */
  inputId?: string;
  placeholder?: string;
}

/**
 * Debounced location search backed by `/api/location/search`. Region-locked to
 * Greater Tokyo by the upstream proxy. Selection sets the form's `location`
 * field; the X button clears it.
 *
 * No external map preview here — keeping it lightweight. If a user wants to
 * verify a pick, the address line under the result is usually enough.
 */
export function LocationAutocomplete({ value, onChange, inputId, placeholder }: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<LocationSearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const lastQueryRef = useRef('');

  // Close dropdown on outside click.
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Debounced fetch. Cancels on every keystroke; only the final query lands.
  useEffect(() => {
    if (!query.trim() || query === value?.name) {
      setResults([]);
      return;
    }
    setLoading(true);
    setError(null);
    const ctrl = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const res = await fetch(`/api/location/search?q=${encodeURIComponent(query)}`, {
          signal: ctrl.signal,
        });
        if (!res.ok) {
          if (res.status === 503) {
            setError('Location lookup not configured.');
          } else {
            setError('Could not search.');
          }
          setResults([]);
        } else {
          const data: LocationSearchResponse = await res.json();
          lastQueryRef.current = query;
          setResults(data.results);
          setOpen(true);
        }
      } catch (err) {
        if (!(err instanceof DOMException && err.name === 'AbortError')) {
          console.error('Location search failed:', err);
          setError('Could not search.');
        }
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => {
      ctrl.abort();
      window.clearTimeout(timer);
    };
  }, [query, value?.name]);

  const handleSelect = useCallback(
    (r: LocationSearchResult) => {
      onChange({
        name: r.name,
        address: r.address,
        lat: r.lat,
        lng: r.lng,
        placeId: r.placeId,
      });
      setQuery('');
      setOpen(false);
    },
    [onChange],
  );

  const handleClear = useCallback(() => {
    onChange(undefined);
    setQuery('');
    setResults([]);
    setOpen(false);
  }, [onChange]);

  return (
    <div ref={containerRef} className="relative">
      {value ? (
        <div className="flex items-center gap-2 p-2 rounded border border-slate-300 bg-slate-50">
          <div className="flex-grow min-w-0">
            <div className="text-sm font-medium truncate">📍 {value.name}</div>
            {value.address && (
              <div className="text-xs text-gray-500 truncate">{value.address}</div>
            )}
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleClear}
            className="text-gray-500 hover:text-gray-700 flex-shrink-0"
            title="Remove location"
            aria-label="Remove location"
          >
            ✕
          </Button>
        </div>
      ) : (
        <>
          <Input
            id={inputId}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => results.length > 0 && setOpen(true)}
            placeholder={placeholder ?? 'Search a place in Tokyo…'}
            autoComplete="off"
          />
          {loading && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">…</div>
          )}
          {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
          {open && results.length > 0 && (
            <ul
              className="absolute z-20 mt-1 w-full max-h-64 overflow-y-auto rounded-md border border-slate-200 bg-white shadow-lg"
              role="listbox"
            >
              {results.map((r, i) => (
                <li key={`${r.placeId ?? r.name}-${i}`}>
                  <button
                    type="button"
                    onClick={() => handleSelect(r)}
                    className="w-full px-3 py-2 text-left hover:bg-slate-50 focus:bg-slate-50 focus:outline-none border-b last:border-b-0 border-slate-100"
                  >
                    <div className="text-sm font-medium truncate">{r.name}</div>
                    {r.address && (
                      <div className="text-xs text-gray-500 truncate">{r.address}</div>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {open && !loading && results.length === 0 && lastQueryRef.current === query && (
            <p className="text-xs text-gray-500 mt-1">No matches.</p>
          )}
        </>
      )}
    </div>
  );
}
