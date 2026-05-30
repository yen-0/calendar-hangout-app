'use client';

export const dynamic = 'force-dynamic';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { db } from '@/lib/firebase/config';
import { useLanguage } from '@/hooks/useLanguage';
import {
  acceptFriendRequest,
  declineFriendRequest,
  fetchPublicUserProfiles,
  FriendshipRecordClient,
  getFriendRelation,
  PublicUserProfileClient,
  sendFriendRequest,
} from '@/lib/firebase/friendsService';
import { showErrorToast, showSuccessToast } from '@/lib/toasts';
import { useRouter } from 'next/navigation';

export default function FriendsPage() {
  const { user, loading: authLoading, isGuest } = useAuth();
  const { t } = useLanguage();
  const router = useRouter();
  const [profiles, setProfiles] = useState<PublicUserProfileClient[]>([]);
  const [friendships, setFriendships] = useState<FriendshipRecordClient[]>([]);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  const makeInitials = useCallback((name: string) => {
    const parts = name.trim().split(/\s+/).filter(Boolean).slice(0, 2);
    if (parts.length === 0) return '?';
    return parts.map((part) => part[0]?.toUpperCase() ?? '').join('');
  }, []);

  const avatarClasses =
    'flex h-11 w-11 items-center justify-center overflow-hidden rounded-full border border-gray-200 bg-gradient-to-br from-slate-100 to-slate-200 text-sm font-semibold text-slate-700';

  useEffect(() => {
    if (!user || isGuest) {
      setProfiles([]);
      setFriendships([]);
      setIsLoading(false);
      return;
    }

    let alive = true;
    setIsLoading(true);

    void fetchPublicUserProfiles()
      .then((nextProfiles) => {
        if (alive) setProfiles(nextProfiles);
      })
      .catch((err) => {
        console.error('Failed to load profiles:', err);
        showErrorToast(t.friends.couldNotLoadDirectory);
      });

    const friendshipQuery = query(
      collection(db, 'friendships'),
      where('participantUids', 'array-contains', user.uid),
    );
    const unsubscribe = onSnapshot(
      friendshipQuery,
      (snapshot) => {
        setFriendships(
          snapshot.docs.map((docSnap) => ({
            ...(docSnap.data() as Omit<FriendshipRecordClient, 'id'>),
            id: docSnap.id,
          })),
        );
        setIsLoading(false);
      },
      (error) => {
        console.error('Failed to load friendships:', error);
        showErrorToast(t.friends.couldNotLoadFriendships);
        setIsLoading(false);
      },
    );

    return () => {
      alive = false;
      unsubscribe();
    };
  }, [user, isGuest, t]);

  const relationByUid = useMemo(() => {
    const map = new Map<string, { relation: ReturnType<typeof getFriendRelation>; friendship?: FriendshipRecordClient }>();
    for (const friendship of friendships) {
      for (const uid of friendship.participantUids) {
        map.set(uid, {
          relation: getFriendRelation(user?.uid ?? '', friendship),
          friendship,
        });
      }
    }
    return map;
  }, [friendships, user?.uid]);

  const filteredProfiles = useMemo(() => {
    const term = search.trim().toLowerCase();
    return profiles.filter((profile) => {
      if (!user || profile.uid === user.uid) return false;
      if (!term) return true;
      return profile.searchText.includes(term);
    });
  }, [profiles, search, user]);

  const incomingRequests = useMemo(
    () =>
      friendships.filter(
        (friendship) =>
          friendship.status === 'pending' && friendship.requestedByUid !== user?.uid,
      ),
    [friendships, user?.uid],
  );

  const acceptedFriends = useMemo(
    () =>
      profiles.filter((profile) => {
        if (!user || profile.uid === user.uid) return false;
        return relationByUid.get(profile.uid)?.relation === 'accepted';
      }),
    [profiles, relationByUid, user],
  );

  const friendSummary = useMemo(() => {
    return {
      friends: acceptedFriends.length,
      incoming: incomingRequests.length,
      outgoing: friendships.filter(
        (friendship) => friendship.status === 'pending' && friendship.requestedByUid === user?.uid,
      ).length,
    };
  }, [acceptedFriends.length, incomingRequests.length, friendships, user?.uid]);

  const handleAddFriend = useCallback(
    async (profile: PublicUserProfileClient) => {
      if (!user) return;
      try {
        await sendFriendRequest(user.uid, profile.uid);
        showSuccessToast(t.friends.friendRequestSentTo(profile.displayName));
      } catch (err) {
        console.error('Failed to send friend request:', err);
        showErrorToast(t.friends.couldNotSendFriendRequest);
      }
    },
    [user, t],
  );

  const handleAccept = useCallback(
    async (friendshipId: string) => {
      try {
        await acceptFriendRequest(friendshipId);
        showSuccessToast(t.friends.friendRequestAccepted);
      } catch (err) {
        console.error('Failed to accept friend request:', err);
        showErrorToast(t.friends.couldNotAcceptFriendRequest);
      }
    },
    [t],
  );

  const handleDecline = useCallback(
    async (friendshipId: string) => {
      try {
        await declineFriendRequest(friendshipId);
        showSuccessToast(t.friends.friendRequestRemoved);
      } catch (err) {
        console.error('Failed to remove friend request:', err);
        showErrorToast(t.friends.couldNotRemoveFriendRequest);
      }
    },
    [t],
  );

  const handleInviteToHangout = useCallback((profile: PublicUserProfileClient) => {
    router.push(`/tsudoi/request?recipient=${encodeURIComponent(profile.uid)}`);
  }, [router]);

  if (authLoading || isLoading) {
    return <div className="p-6 text-center text-gray-500">{t.friends.loadingFriends}</div>;
  }

  if (!user || isGuest) {
    return (
      <div className="mx-auto max-w-2xl rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm">
        <h1 className="text-2xl font-semibold">{t.friends.title}</h1>
        <p className="mt-3 text-gray-600">{t.friends.signInPrompt}</p>
        <div className="mt-6">
          <Link href="/sign-in">
            <Button>{t.friends.signIn}</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4">
      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-3xl font-semibold">{t.friends.title}</h1>
            <p className="mt-2 text-sm text-gray-600">{t.friends.searchDescription}</p>
          </div>
          <div className="w-full md:max-w-sm">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t.friends.searchPlaceholder}
            />
          </div>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          {[
            { label: t.friends.summaryFriends, value: friendSummary.friends, tone: 'bg-emerald-50 text-emerald-700' },
            { label: t.friends.summaryIncoming, value: friendSummary.incoming, tone: 'bg-amber-50 text-amber-700' },
            { label: t.friends.summaryOutgoing, value: friendSummary.outgoing, tone: 'bg-sky-50 text-sky-700' },
          ].map((item) => (
            <div key={item.label} className={`rounded-xl px-4 py-3 ${item.tone}`}>
              <p className="text-xs font-medium uppercase tracking-wide">{item.label}</p>
              <p className="mt-1 text-2xl font-semibold">{item.value}</p>
            </div>
          ))}
        </div>
      </div>

      {incomingRequests.length > 0 && (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
          <h2 className="text-lg font-medium text-amber-900">{t.friends.incomingRequests}</h2>
          <div className="mt-4 space-y-3">
            {incomingRequests.map((friendship) => {
              const otherUid = friendship.participantUids.find((uid) => uid !== user.uid);
              const profile = profiles.find((p) => p.uid === otherUid);
              return (
                <div key={friendship.id} className="flex flex-col gap-3 rounded-lg border border-amber-200 bg-white p-4 md:flex-row md:items-center md:justify-between">
                  <div className="flex items-center gap-3">
                    <div className={avatarClasses}>
                      {profile?.photoURL ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={profile.photoURL} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <span>{makeInitials(profile?.displayName ?? 'U')}</span>
                      )}
                    </div>
                    <div>
                      <p className="font-medium">{profile?.displayName ?? t.friends.unknownUser}</p>
                      <p className="text-sm text-gray-600">{profile?.email ?? t.friends.noEmail}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => void handleAccept(friendship.id)}>
                      {t.friends.accept}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => void handleDecline(friendship.id)}>
                      {t.friends.decline}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-medium">{t.friends.yourFriends}</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {acceptedFriends.length > 0 ? (
            acceptedFriends.map((profile) => (
              <div key={profile.uid} className="rounded-xl border border-gray-200 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className={avatarClasses}>
                      {profile.photoURL ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={profile.photoURL} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <span>{makeInitials(profile.displayName)}</span>
                      )}
                    </div>
                    <div>
                      <p className="font-medium">{profile.displayName}</p>
                      <p className="text-sm text-gray-600">{profile.email}</p>
                    </div>
                  </div>
                  <span className="rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-700">
                    {t.friends.connected}
                  </span>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button size="sm" onClick={() => handleInviteToHangout(profile)}>
                    {t.friends.sendHangout}
                  </Button>
                  {relationByUid.get(profile.uid)?.friendship?.id && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        void handleDecline(relationByUid.get(profile.uid)?.friendship?.id ?? '')
                      }
                    >
                      {t.friends.remove}
                    </Button>
                  )}
                </div>
              </div>
            ))
          ) : (
            <p className="text-sm text-gray-500">{t.friends.noAcceptedFriends}</p>
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-medium">{t.friends.searchResults}</h2>
        <div className="mt-4 space-y-3">
          {filteredProfiles.length > 0 ? (
            filteredProfiles.map((profile) => {
              const relation = relationByUid.get(profile.uid)?.relation ?? 'none';
              const friendshipId = relationByUid.get(profile.uid)?.friendship?.id;
              return (
                <div key={profile.uid} className="flex flex-col gap-3 rounded-xl border border-gray-200 p-4 md:flex-row md:items-center md:justify-between">
                  <div className="flex items-center gap-3">
                    <div className={avatarClasses}>
                      {profile.photoURL ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={profile.photoURL} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <span>{makeInitials(profile.displayName)}</span>
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{profile.displayName}</p>
                        {relation === 'accepted' && (
                          <span className="rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-700">
                            {t.friends.friendBadge}
                          </span>
                        )}
                        {relation === 'incoming' && (
                          <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-medium text-amber-700">
                            {t.friends.incomingRequestBadge}
                          </span>
                        )}
                        {relation === 'outgoing' && (
                          <span className="rounded-full bg-blue-100 px-2 py-1 text-xs font-medium text-blue-700">
                            {t.friends.requestSentBadge}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-600">{profile.email}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {relation === 'none' && (
                      <Button size="sm" onClick={() => void handleAddFriend(profile)}>
                        {t.friends.addFriend}
                      </Button>
                    )}
                    {relation === 'incoming' && friendshipId && (
                      <>
                        <Button size="sm" onClick={() => void handleAccept(friendshipId)}>
                          {t.friends.accept}
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => void handleDecline(friendshipId)}>
                          {t.friends.decline}
                        </Button>
                      </>
                    )}
                    {relation === 'outgoing' && friendshipId && (
                      <Button size="sm" variant="outline" onClick={() => void handleDecline(friendshipId)}>
                        {t.friends.cancelRequest}
                      </Button>
                    )}
                    {relation === 'accepted' && (
                      <>
                        <Button size="sm" onClick={() => handleInviteToHangout(profile)}>
                          {t.friends.sendHangout}
                        </Button>
                        {friendshipId && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => void handleDecline(friendshipId)}
                          >
                            {t.friends.removeFriend}
                          </Button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              );
            })
          ) : (
            <p className="text-sm text-gray-500">{t.friends.noUsersMatch}</p>
          )}
        </div>
      </section>

    </div>
  );
}
