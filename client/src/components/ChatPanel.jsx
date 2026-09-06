import { useEffect, useRef, useState } from 'react';
import { Send, UserPlus, X } from 'lucide-react';

import { setActiveConversationId } from '../lib/activeConversation';
import { acquireChatSocket, releaseChatSocket } from '../lib/socket';
import Button from './Button';
import { cn } from '../lib/cn';

const formatTime = (value) =>
  new Date(value).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

/**
 * Shared message thread for both the portal (customer) and internal (staff)
 * chat UIs — same conversation, same events, only the token/audience and
 * "is this message mine" check differ.
 */
const ChatPanel = ({
  conversationId,
  audience,
  token,
  fetchHistory,
  isMine,
  onAssigned,
  onParticipantAdded,
  headerActions,
  onClose,
}) => {
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  // The other side's live presence in THIS conversation — see roomPresence()
  // in realtime/socket.js. Portal shows repOnline, internal shows customerOnline.
  const [presence, setPresence] = useState({ customerOnline: false, repOnline: false });
  const socketRef = useRef(null);
  const listRef = useRef(null);

  useEffect(() => {
    let cancelled = false;

    setActiveConversationId(conversationId);

    fetchHistory(conversationId)
      .then((history) => {
        if (!cancelled) setMessages(history);
      })
      .catch(() => {});

    const socket = acquireChatSocket(token, audience);
    socketRef.current = socket;

    const handleConnect = () => {
      setIsConnected(true);
      socket.emit('chat:join', { conversationId }, (res) => {
        if (!res?.ok) {
          setIsConnected(false);
          return;
        }
        if (res.presence) setPresence(res.presence);
      });
    };

    const handleDisconnect = () => setIsConnected(false);

    const handleMessage = (message) => {
      if (message.conversationId !== conversationId) return;
      setMessages((prev) => [...prev, message]);
    };

    const handleAssigned = (payload) => {
      if (payload.conversationId === conversationId) onAssigned?.(payload);
    };

    const handleParticipantAdded = (payload) => {
      if (payload.conversationId === conversationId) onParticipantAdded?.(payload);
    };

    const handlePresence = (payload) => {
      if (payload.conversationId === conversationId) setPresence(payload);
    };

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('chat:message', handleMessage);
    socket.on('chat:assigned', handleAssigned);
    socket.on('chat:participant:added', handleParticipantAdded);
    socket.on('chat:presence', handlePresence);

    // The shared socket may already be connected (another consumer opened
    // it first) — 'connect' won't fire again, so join explicitly this time.
    if (socket.connected) handleConnect();

    return () => {
      cancelled = true;
      setActiveConversationId(null);
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('chat:message', handleMessage);
      socket.off('chat:assigned', handleAssigned);
      socket.off('chat:participant:added', handleParticipantAdded);
      socket.off('chat:presence', handlePresence);
      releaseChatSocket(audience);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId, token, audience]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const send = (event) => {
    event.preventDefault();
    const body = draft.trim();
    if (!body || !socketRef.current) return;

    socketRef.current.emit('chat:message', { conversationId, body }, (res) => {
      if (res?.ok) setDraft('');
    });
  };

  return (
    <div className="flex h-[30rem] w-full max-w-md flex-col rounded-xl border border-slate-200 bg-white shadow-xl ring-1 ring-black/5">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 bg-slate-50/70 rounded-t-xl">
        <div className="flex items-center gap-2.5">
          <span className="relative flex size-2.5">
            {isConnected && (
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            )}
            <span
              className={cn(
                'relative inline-flex size-2.5 rounded-full',
                isConnected ? 'bg-emerald-500' : 'bg-slate-300'
              )}
            />
          </span>
          <div>
            <p className="text-xs font-semibold text-slate-900">
              {audience === 'portal' ? 'Netrix Systems Support' : 'Customer Thread'}
            </p>
            <p className="text-[10px] text-slate-400">
              {!isConnected
                ? 'Connecting to socket…'
                : audience === 'portal'
                  ? presence.repOnline
                    ? 'Our team is online'
                    : 'Our team will reply when back online'
                  : presence.customerOnline
                    ? 'Customer is online'
                    : 'Customer is away'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {headerActions}
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="flex size-7 items-center justify-center rounded-md text-slate-400 hover:bg-slate-200/60 hover:text-slate-700 transition-colors"
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div ref={listRef} className="flex-1 space-y-3.5 overflow-y-auto px-4 py-4">
        {messages.length === 0 && (
          <div className="pt-12 text-center">
            <p className="text-xs font-medium text-slate-500">No messages yet</p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Type below to begin realtime negotiations.
            </p>
          </div>
        )}

        {messages.map((message) => {
          if (message.senderType === 'SYSTEM') {
            return (
              <div key={message.id} className="my-2 text-center">
                <span className="inline-block rounded-full bg-slate-100 px-3 py-1 text-[11px] font-medium text-slate-500">
                  {message.body}
                </span>
              </div>
            );
          }

          const mine = isMine(message);
          const senderName =
            message.senderUser?.name ?? message.senderCustomer?.name ?? (mine ? 'You' : 'Client');

          return (
            <div
              key={message.id}
              className={cn('flex flex-col', mine ? 'items-end' : 'items-start')}
            >
              <span className="mb-1 text-[10px] font-semibold text-slate-400 px-1">
                {mine ? 'You' : senderName}
              </span>
              <div
                className={cn(
                  'max-w-[85%] rounded-2xl px-3.5 py-2 text-xs leading-relaxed shadow-2xs',
                  mine
                    ? 'bg-brand-600 text-white rounded-br-xs'
                    : 'bg-slate-100 text-slate-900 rounded-bl-xs'
                )}
              >
                <p className="whitespace-pre-wrap">{message.body}</p>
                <p
                  className={cn(
                    'mt-1 text-right text-[10px]',
                    mine ? 'text-brand-200' : 'text-slate-400'
                  )}
                >
                  {formatTime(message.createdAt)}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Input Composer */}
      <form
        onSubmit={send}
        className="flex items-center gap-2 border-t border-slate-100 p-2.5 bg-slate-50/50 rounded-b-xl"
      >
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Type a message or request terms change…"
          className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-brand-600 focus:ring-1 focus:ring-brand-600"
        />
        <Button
          type="submit"
          size="sm"
          disabled={!draft.trim() || !isConnected}
          className="shrink-0"
        >
          <Send className="size-3.5" aria-hidden="true" />
        </Button>
      </form>
    </div>
  );
};

export const CollaboratorIcon = UserPlus;

export default ChatPanel;
