import { useEffect, useRef, useState } from 'react';
import { Send, UserPlus, X } from 'lucide-react';

import { connectChatSocket } from '../lib/socket';
import Button from './Button';

const formatTime = (value) =>
  new Date(value).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

/**
 * Shared message thread for both the portal (customer) and internal (staff)
 * chat UIs — same conversation, same events, only the token/audience and
 * "is this message mine" check differ.
 *
 * onAssigned / onParticipantAdded are optional callbacks so a parent page
 * (e.g. the customer's "waiting for a rep" screen) can react to those events
 * without this component knowing anything about that context.
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
  const socketRef = useRef(null);
  const listRef = useRef(null);

  useEffect(() => {
    let cancelled = false;

    fetchHistory(conversationId)
      .then((history) => {
        if (!cancelled) setMessages(history);
      })
      .catch(() => {});

    const socket = connectChatSocket(token, audience);
    socketRef.current = socket;

    socket.on('connect', () => {
      setIsConnected(true);
      socket.emit('chat:join', { conversationId }, (res) => {
        if (!res?.ok) setIsConnected(false);
      });
    });

    socket.on('disconnect', () => setIsConnected(false));

    socket.on('chat:message', (message) => {
      if (message.conversationId !== conversationId) return;
      setMessages((prev) => [...prev, message]);
    });

    socket.on('chat:assigned', (payload) => {
      if (payload.conversationId === conversationId) onAssigned?.(payload);
    });

    socket.on('chat:participant:added', (payload) => {
      if (payload.conversationId === conversationId) onParticipantAdded?.(payload);
    });

    return () => {
      cancelled = true;
      socket.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId, token, audience]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
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
    <div className="flex h-[28rem] w-full max-w-md flex-col rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span
            className={`size-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-slate-300'}`}
            aria-hidden="true"
          />
          <p className="text-sm font-medium text-slate-900">
            {isConnected ? 'Connected' : 'Connecting…'}
          </p>
        </div>
        <div className="flex items-center gap-1">
          {headerActions}
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="flex size-7 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          )}
        </div>
      </div>

      <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
        {messages.length === 0 && (
          <p className="pt-8 text-center text-sm text-slate-400">No messages yet — say hello.</p>
        )}
        {messages.map((message) =>
          message.senderType === 'SYSTEM' ? (
            <p key={message.id} className="text-center text-xs text-slate-400">
              {message.body}
            </p>
          ) : (
            <div
              key={message.id}
              className={`flex ${isMine(message) ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                  isMine(message)
                    ? 'bg-brand-600 text-white'
                    : 'bg-slate-100 text-slate-900'
                }`}
              >
                {!isMine(message) && (
                  <p className="mb-0.5 text-xs font-medium opacity-70">
                    {message.senderUser?.name ?? message.senderCustomer?.name ?? 'Them'}
                  </p>
                )}
                <p className="whitespace-pre-wrap">{message.body}</p>
                <p className="mt-1 text-right text-[10px] opacity-60">
                  {formatTime(message.createdAt)}
                </p>
              </div>
            </div>
          )
        )}
      </div>

      <form onSubmit={send} className="flex items-center gap-2 border-t border-slate-200 p-2.5">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Type a message…"
          className="flex-1 rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:border-brand-500 focus:outline-none"
        />
        <Button type="submit" size="sm" disabled={!draft.trim()}>
          <Send className="size-4" aria-hidden="true" />
        </Button>
      </form>
    </div>
  );
};

export const CollaboratorIcon = UserPlus;

export default ChatPanel;
