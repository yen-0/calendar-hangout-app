'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { StampPackClient } from '@/types/stampPacks';
import { fetchStampPack } from '@/lib/firebase/firestoreService';
import { useCalendarStore } from '@/hooks/useCalendarStore';
import { unpackStamp } from '@/lib/stampPackSerialize';
import { showErrorToast, showInfoToast, showSuccessToast } from '@/lib/toasts';

export default function StampPackImportPage() {
  const params = useParams();
  const packId = (params?.packId as string | undefined) ?? '';
  const { user, isGuest, loading: authLoading } = useAuth();
  const store = useCalendarStore();

  const [pack, setPack] = useState<StampPackClient | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [imported, setImported] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!packId) {
      setError('Missing pack id.');
      setLoading(false);
      return;
    }
    setLoading(true);
    fetchStampPack(packId)
      .then((result) => {
        if (cancelled) return;
        if (!result) {
          setError('Pack not found, or the link has been revoked.');
        } else if (result.revokedAt) {
          setError('This pack link has been revoked by its owner.');
        } else {
          setPack(result);
        }
      })
      .catch((err) => {
        console.error('Error fetching stamp pack:', err);
        if (!cancelled) setError('Could not load this pack.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [packId]);

  const handleImport = useCallback(async () => {
    if (!pack) return;
    if (!user || isGuest) {
      showErrorToast('Sign in to import a pack.');
      return;
    }
    setImporting(true);
    try {
      const results = await Promise.allSettled(
        pack.stamps.map((p) => store.addEvent(unpackStamp(p))),
      );
      const failed = results.filter((r) => r.status === 'rejected').length;
      if (failed === 0) {
        showSuccessToast(`Imported ${pack.stamps.length} stamps.`);
        setImported(true);
      } else {
        showInfoToast(`Imported ${pack.stamps.length - failed} of ${pack.stamps.length}.`);
        setImported(true);
      }
    } catch (err) {
      console.error('Error importing pack:', err);
      showErrorToast('Could not import pack.');
    } finally {
      setImporting(false);
    }
  }, [pack, user, isGuest, store]);

  if (authLoading || loading) {
    return <div className="max-w-2xl mx-auto p-6 text-gray-500">Loading…</div>;
  }

  if (error) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <h1 className="text-xl font-semibold mb-2">Stamp pack</h1>
        <p className="text-red-700">{error}</p>
        <Link href="/calendar" className="text-indigo-600 underline mt-4 inline-block">
          Back to calendar
        </Link>
      </div>
    );
  }

  if (!pack) return null;

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-1">{pack.name}</h1>
      {pack.description && <p className="text-gray-700 mb-4">{pack.description}</p>}
      <p className="text-xs text-gray-500 mb-6">
        {pack.stamps.length} stamp{pack.stamps.length === 1 ? '' : 's'} · shared{' '}
        {pack.createdAt.toLocaleDateString()}
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
        {pack.stamps.map((stamp, idx) => {
          const startH = Math.floor(stamp.startMinutes / 60);
          const startM = stamp.startMinutes % 60;
          return (
            <div
              key={idx}
              className="flex items-start gap-3 p-3 border rounded"
              style={{ borderColor: stamp.color || '#ccc' }}
            >
              <span className="text-2xl flex-shrink-0">{stamp.emoji}</span>
              <div className="flex-grow min-w-0">
                <div className="font-medium truncate">{stamp.title}</div>
                <div className="text-xs text-gray-500">
                  {`${String(startH).padStart(2, '0')}:${String(startM).padStart(2, '0')}`} ·{' '}
                  {stamp.durationMinutes} min
                  {stamp.category ? ` · ${stamp.category}` : ''}
                  {stamp.availability && stamp.availability !== 'busy'
                    ? ` · ${stamp.availability}`
                    : ''}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {imported ? (
        <div className="space-y-3">
          <p className="text-green-700 font-medium">All set — these stamps are now in your palette.</p>
          <Link href="/calendar" className="inline-block">
            <Button>Go to calendar</Button>
          </Link>
        </div>
      ) : !user || isGuest ? (
        <div className="space-y-3">
          <p className="text-sm text-gray-600">Sign in to add these to your stamps.</p>
          <Link href="/sign-in" className="inline-block">
            <Button>Sign in to import</Button>
          </Link>
        </div>
      ) : (
        <Button
          onClick={handleImport}
          isLoading={importing}
          disabled={importing}
          className="bg-indigo-600 hover:bg-indigo-700 text-white"
        >
          Import all {pack.stamps.length} stamp{pack.stamps.length === 1 ? '' : 's'}
        </Button>
      )}
    </div>
  );
}
