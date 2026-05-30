'use client';

import Link from 'next/link';
import { format } from 'date-fns';
import { HangoutRequestClientState } from '@/types/hangouts';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/hooks/useLanguage';

interface Props {
  request: HangoutRequestClientState;
  isCreator: boolean;
  isProcessing: boolean;
  onCopyShareLink: (id: string) => void;
  onEdit: (req: HangoutRequestClientState) => void;
  onDelete: (req: HangoutRequestClientState) => void;
  onCloseOrArchive: (req: HangoutRequestClientState) => void;
}

export function HangoutRequestCard({
  request,
  isCreator,
  isProcessing,
  onCopyShareLink,
  onEdit,
  onDelete,
  onCloseOrArchive,
}: Props) {
  const participantCount = Object.keys(request.participants || {}).length;
  const memberTarget =
    request.desiredMemberCount > 0 ? `${participantCount} / ${request.desiredMemberCount}` : `${participantCount}`;
  const { t } = useLanguage();
  const showCreatorActions = isCreator && request.status !== 'closed';
  const allowEditDelete = request.status !== 'confirmed';

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-lg font-semibold text-blue-700 hover:underline">
            <Link href={`/tsudoi/reply/${request.id}`}>{request.requestName}</Link>
          </h2>
          <p className="text-xs text-gray-500">
            {t.hangouts.created}: {format(request.createdAt, 'PPP')}
          </p>
          <p className="text-xs text-gray-500">
            {t.hangouts.status}: <span className="font-medium capitalize">{request.status.replace(/_/g, ' ')}</span>
          </p>
          <p className="text-xs text-gray-500">
            {t.hangouts.participants}: {memberTarget}
            {request.desiredMemberCount <= 0 ? ' (not decided)' : ''}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => onCopyShareLink(request.id)}>
          {t.hangouts.copyShareLink}
        </Button>
      </div>
      {showCreatorActions && (
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-gray-200 pt-3">
          {allowEditDelete && (
            <>
              <Button variant="outline" size="sm" onClick={() => onEdit(request)} disabled={isProcessing}>
                {t.hangouts.edit}
              </Button>
              <Button variant="destructive" size="sm" onClick={() => onDelete(request)} disabled={isProcessing}>
                {t.hangouts.delete}
              </Button>
            </>
          )}
          <Button variant="secondary" size="sm" onClick={() => onCloseOrArchive(request)} disabled={isProcessing}>
            {request.status === 'confirmed' ? t.hangouts.archiveDone : t.hangouts.closeRequest}
          </Button>
        </div>
      )}
    </div>
  );
}

