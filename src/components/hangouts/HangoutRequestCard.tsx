'use client';

import Link from 'next/link';
import { format } from 'date-fns';
import { HangoutRequestClientState } from '@/types/hangouts';
import { Button } from '@/components/ui/button';

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
  const showCreatorActions = isCreator && request.status !== 'closed';
  const allowEditDelete = request.status !== 'confirmed';

  return (
    <div className="p-4 bg-white rounded-lg shadow border border-gray-200">
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-lg font-semibold text-blue-700 hover:underline">
            <Link href={`/hangouts/reply/${request.id}`}>{request.requestName}</Link>
          </h2>
          <p className="text-xs text-gray-500">Created: {format(request.createdAt, 'PPP')}</p>
          <p className="text-xs text-gray-500">
            Status: <span className="font-medium capitalize">{request.status.replace(/_/g, ' ')}</span>
          </p>
          <p className="text-xs text-gray-500">
            Participants: {participantCount} / {request.desiredMemberCount}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => onCopyShareLink(request.id)}>
          Copy Share Link
        </Button>
      </div>
      {showCreatorActions && (
        <div className="mt-4 pt-3 border-t border-gray-200 flex flex-wrap items-center gap-2">
          {allowEditDelete && (
            <>
              <Button variant="outline" size="sm" onClick={() => onEdit(request)} disabled={isProcessing}>
                Edit
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => onDelete(request)}
                disabled={isProcessing}
              >
                Delete
              </Button>
            </>
          )}
          <Button
            variant="secondary"
            size="sm"
            onClick={() => onCloseOrArchive(request)}
            disabled={isProcessing}
          >
            {request.status === 'confirmed' ? 'Archive (Mark as Done)' : 'Close Request'}
          </Button>
        </div>
      )}
    </div>
  );
}
