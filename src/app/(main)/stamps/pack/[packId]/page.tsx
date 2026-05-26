'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/hooks/useLanguage';
import { StampPackClient } from '@/types/stampPacks';
import { fetchStampPack } from '@/lib/firebase/firestoreService';
import { useCalendarStore } from '@/hooks/useCalendarStore';
import { unpackStamp } from '@/lib/stampPackSerialize';
import { showErrorToast, showInfoToast, showSuccessToast } from '@/lib/toasts';

export default function StampPackImportPage() {
  const params = useParams();
  const packId = (params?.packId as string | undefined) ?? '';
  const { user, isGuest, loading: authLoading } = useAuth();
  const { t } = useLanguage();
  const store = useCalendarStore();

  const [pack, setPack] = useState<StampPackClient | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [imported, setImported] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!packId) {
      setError(t.stampPackImport.missingPackId);
      setLoading(false);
      return;
    }
    setLoading(true);
    fetchStampPack(packId)
      .then((result) => {
        if (cancelled) return;
        if (!result) {
          setError(t.stampPackImport.packNotFound);
        } else if (result.revokedAt) {
          setError(t.stampPackImport.packRevoked);
        } else {
          setPack(result);
        }
      })
      .catch((err) => {
        console.error('Error fetching stamp pack:', err);
        if (!cancelled) setError(t.stampPackImport.couldNotLoad);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [packId, t]);

  const handleImport = useCallback(async () => {
    if (!pack) return;
    if (!user || isGuest) {
      showErrorToast(t.stampPackImport.signInToImport);
      return;
    }
    setImporting(true);
    try {
      const results = await Promise.allSettled(
        pack.stamps.map((p) => store.addEvent(unpackStamp(p))),
      );
      const failed = results.filter((r) => r.status === 'rejected').length;
      if (failed === 0) {
        showSuccessToast(t.stampPackImport.importedAll(pack.stamps.length));
        setImported(true);
      } else {
        showInfoToast(
          t.stampPackImport.importedSome(pack.stamps.length - failed, pack.stamps.length),
        );
        setImported(true);
      }
    } catch (err) {
      console.error('Error importing pack:', err);
      showErrorToast(t.stampPackImport.couldNotImport);
    } finally {
      setImporting(false);
    }
  }, [pack, user, isGuest, store, t]);

  if (authLoading || loading) {
    return <div className="mx-auto max-w-2xl p-6 text-gray-500">{t.stampPackImport.loading}</div>;
  }

  if (error) {
    return (
      <div className="mx-auto max-w-2xl p-6">
        <h1 className="mb-2 text-xl font-semibold">{t.stampPackImport.title}</h1>
        <p className="text-red-700">{error}</p>
        <Link href="/calendar" className="mt-4 inline-block text-indigo-600 underline">
          {t.stampPackImport.backToCalendar}
        </Link>
      </div>
    );
  }

  if (!pack) return null;

  return (
    <div className="mx-auto max-w-2xl p-6">
      <h1 className="mb-1 text-2xl font-bold">{pack.name}</h1>
      {pack.description && <p className="mb-4 text-gray-700">{pack.description}</p>}
      <p className="mb-6 text-xs text-gray-500">
        {pack.stamps.length} stamp{pack.stamps.length === 1 ? '' : 's'} · {t.stampPackImport.shared}{' '}
        {pack.createdAt.toLocaleDateString()}
      </p>

      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {pack.stamps.map((stamp, idx) => {
          const startH = Math.floor(stamp.startMinutes / 60);
          const startM = stamp.startMinutes % 60;
          return (
            <div
              key={idx}
              className="flex items-start gap-3 rounded border p-3"
              style={{ borderColor: stamp.color || '#ccc' }}
            >
              <span className="flex-shrink-0 text-2xl">{stamp.emoji}</span>
              <div className="min-w-0 flex-grow">
                <div className="truncate font-medium">{stamp.title}</div>
                <div className="text-xs text-gray-500">
                  {`${String(startH).padStart(2, '0')}:${String(startM).padStart(2, '0')}`} · {stamp.durationMinutes} min
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
          <p className="font-medium text-green-700">{t.stampPackImport.ready}</p>
          <Link href="/calendar" className="inline-block">
            <Button>{t.stampPackImport.goToCalendar}</Button>
          </Link>
        </div>
      ) : !user || isGuest ? (
        <div className="space-y-3">
          <p className="text-sm text-gray-600">{t.stampPackImport.signInToAdd}</p>
          <Link href="/sign-in" className="inline-block">
            <Button>{t.stampPackImport.signInToImportButton}</Button>
          </Link>
        </div>
      ) : (
        <Button
          onClick={handleImport}
          isLoading={importing}
          disabled={importing}
          className="bg-indigo-600 text-white hover:bg-indigo-700"
        >
          {t.stampPackImport.importAll(pack.stamps.length)}
        </Button>
      )}
    </div>
  );
}
