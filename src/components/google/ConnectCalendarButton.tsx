'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { disconnectGoogle, getGoogleStatus, startGoogleConnect } from '@/lib/google/client';
import { useLanguage } from '@/hooks/useLanguage';

interface Props {
  /** Forces a re-check of connection status when this changes (e.g. after redirect). */
  refreshKey?: string | number;
  onStatusChange?: (connected: boolean) => void;
}

export function ConnectCalendarButton({ refreshKey, onStatusChange }: Props) {
  const [connected, setConnected] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { t } = useLanguage();

  useEffect(() => {
    let cancelled = false;
    setError(null);
    getGoogleStatus()
      .then((s) => {
        if (cancelled) return;
        setConnected(s.connected);
        onStatusChange?.(s.connected);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setConnected(false);
        setError(e instanceof Error ? e.message : t.google.loadError);
      });
    return () => {
      cancelled = true;
    };
  }, [refreshKey, onStatusChange, t.google.loadError]);

  const handleConnect = async () => {
    setBusy(true);
    setError(null);
    try {
      const url = await startGoogleConnect();
      window.location.href = url;
    } catch (e) {
      setError(e instanceof Error ? e.message : t.google.connectError);
      setBusy(false);
    }
  };

  const handleDisconnect = async () => {
    setBusy(true);
    setError(null);
    try {
      await disconnectGoogle();
      setConnected(false);
      onStatusChange?.(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : t.google.disconnectError);
    } finally {
      setBusy(false);
    }
  };

  if (connected === null) {
    return <div className="text-sm text-gray-500">{t.google.checking}</div>;
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        <span
          className={`inline-block h-2 w-2 rounded-full ${connected ? 'bg-green-500' : 'bg-gray-300'}`}
          aria-hidden
        />
        <span className="text-sm">{connected ? t.google.connected : t.google.notConnected}</span>
        {connected ? (
          <Button variant="outline" size="sm" onClick={handleDisconnect} disabled={busy}>
            {t.google.disconnect}
          </Button>
        ) : (
          <Button variant="default" size="sm" onClick={handleConnect} disabled={busy}>
            {t.google.connect}
          </Button>
        )}
      </div>
      {error && <div className="text-sm text-red-600">{error}</div>}
    </div>
  );
}

