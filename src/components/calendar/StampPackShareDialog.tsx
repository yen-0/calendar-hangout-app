'use client';

import { useEffect, useState } from 'react';
import Modal from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CalendarEvent } from '@/types/events';
import { StampPackClient } from '@/types/stampPacks';
import { packStamp } from '@/lib/stampPackSerialize';
import {
  createStampPack,
  listMyStampPacks,
  revokeStampPack,
  unrevokeStampPack,
  deleteStampPack,
} from '@/lib/firebase/firestoreService';
import { showErrorToast, showInfoToast, showSuccessToast } from '@/lib/toasts';
import { useLanguage } from '@/hooks/useLanguage';

interface Props {
  isOpen: boolean;
  stamps: CalendarEvent[];
  ownerUid: string;
  onClose: () => void;
}

export function StampPackShareDialog({ isOpen, stamps, ownerUid, onClose }: Props) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [packs, setPacks] = useState<StampPackClient[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const { t } = useLanguage();

  useEffect(() => {
    if (!isOpen || !ownerUid) return;
    let cancelled = false;
    listMyStampPacks(ownerUid)
      .then((result) => {
        if (!cancelled) setPacks(result);
      })
      .catch((err) => {
        console.error('Error loading stamp packs:', err);
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen, ownerUid, refreshKey]);

  useEffect(() => {
    if (!isOpen) {
      setName('');
      setDescription('');
      setSelectedIds(new Set());
    }
  }, [isOpen]);

  const toggle = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleCreate = async () => {
    if (!name.trim()) {
      showErrorToast('Give the pack a name.');
      return;
    }
    if (selectedIds.size === 0) {
      showErrorToast('Pick at least one stamp.');
      return;
    }
    setBusy(true);
    try {
      const chosen = stamps.filter((s) => selectedIds.has(s.id)).map(packStamp);
      const id = await createStampPack({
        ownerUid,
        name: name.trim(),
        description: description.trim() || undefined,
        stamps: chosen,
      });
      const url = `${window.location.origin}/stamps/pack/${id}`;
      await navigator.clipboard?.writeText(url).catch(() => {});
      showSuccessToast(t.stamps.packCreated);
      setName('');
      setDescription('');
      setSelectedIds(new Set());
      setRefreshKey((k) => k + 1);
    } catch (err) {
      console.error('Error creating stamp pack:', err);
      showErrorToast('Could not create pack.');
    } finally {
      setBusy(false);
    }
  };

  const handleRevoke = async (pack: StampPackClient) => {
    try {
      if (pack.revokedAt) {
        await unrevokeStampPack(pack.id);
        showInfoToast(t.stamps.packRestored);
      } else {
        await revokeStampPack(pack.id);
        showInfoToast(t.stamps.packRevoked);
      }
      setRefreshKey((k) => k + 1);
    } catch (err) {
      console.error('Error toggling revoke:', err);
      showErrorToast('Could not update pack.');
    }
  };

  const handleDelete = async (pack: StampPackClient) => {
    if (!confirm(`Permanently delete pack "${pack.name}"? This cannot be undone.`)) return;
    try {
      await deleteStampPack(pack.id);
      showInfoToast(t.stamps.packDeleted);
      setRefreshKey((k) => k + 1);
    } catch (err) {
      console.error('Error deleting pack:', err);
      showErrorToast('Could not delete pack.');
    }
  };

  const copyLink = (packId: string) => {
    const url = `${window.location.origin}/stamps/pack/${packId}`;
    void navigator.clipboard?.writeText(url);
    showInfoToast(t.stamps.copy);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t.stamps.sharePack} size="lg">
      <div className="space-y-5">
        <section className="space-y-3">
          <div>
            <Label htmlFor="pack-name">{t.stamps.packName}</Label>
            <Input
              id="pack-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. My morning routine"
              maxLength={80}
            />
          </div>
          <div>
            <Label htmlFor="pack-desc">{t.stamps.packDescription}</Label>
            <Input
              id="pack-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="A short note about what's in this pack"
              maxLength={280}
            />
          </div>
          <div>
            <Label>{t.stamps.stampsToInclude}</Label>
            {stamps.length === 0 && (
              <p className="mt-1 text-xs text-gray-500">No stamps to share yet — create some first.</p>
            )}
            {stamps.length > 0 && (
              <div className="mt-1 max-h-48 grid grid-cols-2 gap-2 overflow-y-auto">
                {stamps.map((stamp) => {
                  const selected = selectedIds.has(stamp.id);
                  return (
                    <label
                      key={stamp.id}
                      className={`flex cursor-pointer items-center gap-2 rounded border p-2 text-sm ${selected ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200 hover:bg-gray-50'}`}
                    >
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={() => toggle(stamp.id)}
                        className="h-4 w-4"
                      />
                      <span className="flex-shrink-0 text-lg">{stamp.emoji}</span>
                      <span className="truncate">{stamp.title}</span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>
              {t.common.cancel}
            </Button>
            <Button
              onClick={handleCreate}
              isLoading={busy}
              disabled={busy || stamps.length === 0}
              className="bg-indigo-600 text-white hover:bg-indigo-700"
            >
              {t.stamps.createCopyLink}
            </Button>
          </div>
        </section>

        {packs.length > 0 && (
          <section className="space-y-2 border-t pt-4">
            <h3 className="text-sm font-semibold">Your packs</h3>
            <div className="max-h-56 space-y-2 overflow-y-auto">
              {packs.map((pack) => (
                <div
                  key={pack.id}
                  className={`flex items-center gap-2 rounded border p-2 text-sm ${pack.revokedAt ? 'border-gray-200 bg-gray-50 text-gray-500' : 'border-gray-200'}`}
                >
                  <div className="min-w-0 flex-grow">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-medium">{pack.name}</span>
                      <span className="text-xs text-gray-400">
                        {pack.stamps.length} stamp{pack.stamps.length === 1 ? '' : 's'}
                      </span>
                      {pack.revokedAt && (
                        <span className="rounded bg-red-100 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-red-700">
                          {t.stamps.revoked}
                        </span>
                      )}
                    </div>
                  </div>
                  {!pack.revokedAt && (
                    <Button variant="ghost" size="sm" onClick={() => copyLink(pack.id)}>
                      {t.stamps.copy}
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRevoke(pack)}
                    className={pack.revokedAt ? 'text-green-700' : 'text-amber-700'}
                  >
                    {pack.revokedAt ? t.stamps.packRestore : t.stamps.packRevoke}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => handleDelete(pack)} className="text-red-700">
                    {t.stamps.packDelete}
                  </Button>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </Modal>
  );
}

