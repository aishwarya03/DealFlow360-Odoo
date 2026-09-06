import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { MessageCircle, UserPlus, X } from 'lucide-react';
import toast from 'react-hot-toast';

import {
  addChatParticipant,
  claimChat,
  listChatMessages,
  listChatQueue,
  listCollaboratorCandidates,
  listMyChats,
} from '../../api/chat';
import { getToken } from '../../api/client';
import { acquireChatSocket, releaseChatSocket } from '../../lib/socket';
import Button from '../../components/Button';
import ChatPanel from '../../components/ChatPanel';
import DetailSection from '../../components/DetailSection';
import EmptyState from '../../components/EmptyState';
import PageHeader from '../../components/PageHeader';
import { SkeletonText } from '../../components/Skeleton';
import StatusBadge from '../../components/StatusBadge';
import { useAuth } from '../../hooks/useAuth';

const ROLE_LABEL = { SALES_REP: 'Sales Rep', SALES_MANAGER: 'Sales Manager' };

const ChatInboxPage = () => {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const [queue, setQueue] = useState([]);
  const [mine, setMine] = useState([]);
  const [selected, setSelected] = useState(null);
  const [pendingSelect, setPendingSelect] = useState(null); // an unclaimed queue item opened via link
  const [candidates, setCandidates] = useState(null); // null = picker closed
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = () => {
    setError(false);
    Promise.all([listChatQueue(), listMyChats()])
      .then(([queueRows, mineRows]) => {
        setQueue(queueRows);
        setMine(mineRows);
      })
      .catch(() => {
        toast.error('Could not load chats');
        setError(true);
      })
      .finally(() => setIsLoading(false));
  };

  useEffect(load, []);

  useEffect(() => {
    const socket = acquireChatSocket(getToken(), 'internal');
    const handleQueueUpdated = () => load();

    socket.on('chat:queue:updated', handleQueueUpdated);
    return () => {
      socket.off('chat:queue:updated', handleQueueUpdated);
      releaseChatSocket('internal');
    };
  }, []);

  // Arriving from "View chat" on a quotation page: jump straight to that
  // conversation once the lists have loaded, whether it's already claimed
  // (mine) or still waiting (queue).
  useEffect(() => {
    const conversationId = Number(searchParams.get('conversationId'));
    if (!conversationId || selected) return;

    const inMine = mine.find((c) => c.id === conversationId);
    if (inMine) {
      // One-time jump from a link's query param, not state derived from props/state.
      setSelected(inMine);
      return;
    }

    const inQueue = queue.find((c) => c.id === conversationId);
    if (inQueue) setPendingSelect(inQueue);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, mine, queue]);

  const handleClaim = async (conversationId) => {
    try {
      const conversation = await claimChat(conversationId);
      toast.success('Chat claimed');
      setSelected(conversation);
      setPendingSelect(null);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message ?? 'Could not claim this chat');
    }
  };

  const openCollaboratorPicker = async () => {
    if (!selected) return;
    try {
      setCandidates(await listCollaboratorCandidates(selected.id));
    } catch {
      toast.error('Could not load collaborators');
    }
  };

  const handleAddCollaborator = async (candidate) => {
    try {
      await addChatParticipant(selected.id, candidate.id);
      toast.success(`${candidate.name} added to the chat`);
      setCandidates(null);
    } catch (err) {
      toast.error(err.response?.data?.message ?? 'Could not add collaborator');
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Chat Inbox" subtitle="Live conversations with customers" />

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Couldn&apos;t load chats. Please try again in a moment.
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[20rem_1fr]">
        <div className="space-y-4">
          <DetailSection title="Waiting" description="Nobody has claimed these yet.">
            {isLoading ? (
              <SkeletonText lines={2} />
            ) : queue.length === 0 ? (
              <p className="text-sm text-slate-400">Nothing waiting.</p>
            ) : (
              <div className="-m-4 divide-y divide-slate-100">
                {queue.map((c) => (
                  <div key={c.id} className="flex items-center justify-between px-4 py-3 text-sm transition-colors hover:bg-slate-50">
                    <span className="text-slate-900">{c.customer?.name ?? `Customer #${c.customerId}`}</span>
                    <Button size="sm" onClick={() => handleClaim(c.id)}>
                      Claim
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </DetailSection>

          <DetailSection title="My chats">
            {isLoading ? (
              <SkeletonText lines={2} />
            ) : mine.length === 0 ? (
              <p className="text-sm text-slate-400">No active chats.</p>
            ) : (
              <div className="-m-4 divide-y divide-slate-100">
                {mine.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setSelected(c)}
                    className={`flex w-full items-center justify-between px-4 py-3 text-left text-sm transition-colors hover:bg-slate-50 ${
                      selected?.id === c.id ? 'bg-brand-50' : ''
                    }`}
                  >
                    <span className="text-slate-900">{c.customer?.name ?? `Customer #${c.customerId}`}</span>
                    <StatusBadge status={c.status} dot />
                  </button>
                ))}
              </div>
            )}
          </DetailSection>
        </div>

        <div>
          {selected ? (
            <div className="space-y-3 animate-fade-in">
              <ChatPanel
                key={selected.id}
                conversationId={selected.id}
                audience="internal"
                token={getToken()}
                fetchHistory={listChatMessages}
                isMine={(message) => message.senderType === 'USER' && message.senderUser?.id === user.id}
                headerActions={
                  <button
                    type="button"
                    onClick={openCollaboratorPicker}
                    title="Add a collaborator"
                    className="flex size-7 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
                  >
                    <UserPlus className="size-4" aria-hidden="true" />
                  </button>
                }
                onParticipantAdded={() => load()}
              />

              {candidates && (
                <DetailSection
                  title="Add a collaborator"
                  actions={
                    <button
                      type="button"
                      onClick={() => setCandidates(null)}
                      className="flex size-6 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-100"
                    >
                      <X className="size-3.5" aria-hidden="true" />
                    </button>
                  }
                >
                  {candidates.length === 0 ? (
                    <p className="text-sm text-slate-400">No one else available to add.</p>
                  ) : (
                    <div className="-m-4 divide-y divide-slate-100">
                      {candidates.map((candidate) => (
                        <button
                          key={candidate.id}
                          type="button"
                          onClick={() => handleAddCollaborator(candidate)}
                          className="flex w-full items-center justify-between px-4 py-2.5 text-left text-sm transition-colors hover:bg-slate-50"
                        >
                          <span>
                            {candidate.name}{' '}
                            <span className="text-xs text-slate-400">
                              · {ROLE_LABEL[candidate.role] ?? candidate.role}
                            </span>
                          </span>
                          {candidate.online && <span className="text-xs text-green-600">Online</span>}
                        </button>
                      ))}
                    </div>
                  )}
                </DetailSection>
              )}
            </div>
          ) : pendingSelect ? (
            <DetailSection title="This chat hasn't been claimed yet" className="animate-fade-in">
              <p className="mb-3 text-sm text-slate-500">
                {pendingSelect.customer?.name ?? `Customer #${pendingSelect.customerId}`} is waiting for a
                reply. Claim it to start chatting.
              </p>
              <Button size="sm" onClick={() => handleClaim(pendingSelect.id)}>
                Claim
              </Button>
            </DetailSection>
          ) : (
            <div className="rounded-lg border border-slate-200 bg-white">
              <EmptyState
                icon={MessageCircle}
                title="No conversation selected"
                description="Pick a waiting chat to claim it, or select one of your active conversations from the left."
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ChatInboxPage;
