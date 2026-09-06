import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';

import { getActiveConversationId } from '../lib/activeConversation';
import { acquireChatSocket, releaseChatSocket } from '../lib/socket';

/**
 * A persistent, app-wide listener for chat activity — independent of
 * whether any ChatPanel is currently open. Shares its socket with any open
 * ChatPanel (see lib/socket.js), so mounting this doesn't add a second
 * connection.
 *
 * A message for the conversation currently on screen is skipped (it's
 * already appearing live in that panel) — everything else bumps the unread
 * count and raises a toast. `onExtra`, if given, is called for every event
 * so a page can react beyond the built-in badge/toast (e.g. refreshing a list).
 */
export const useChatNotifications = ({ token, audience, enabled, describeMessage, onExtra }) => {
  const [unreadCount, setUnreadCount] = useState(0);
  const [isAvailable, setIsAvailable] = useState(true);

  useEffect(() => {
    if (!enabled || !token) return undefined;

    const socket = acquireChatSocket(token, audience);

    const handleMessage = (message) => {
      if (message.senderType === 'SYSTEM') return;
      // Don't notify about a message I'm the sender of, or one already
      // visible in the panel that's open right now.
      if (message.conversationId === getActiveConversationId()) return;

      setUnreadCount((count) => count + 1);
      toast(describeMessage?.(message) ?? 'New chat message', { icon: '💬' });
      onExtra?.('message', message);
    };

    const handleAssigned = (payload) => {
      if (audience !== 'portal') return; // reps get this inline in the inbox already
      toast.success('A sales rep joined your chat');
      onExtra?.('assigned', payload);
    };

    const handlePresence = (payload) => {
      if (payload.audience === audience && payload.available !== undefined) {
        setIsAvailable(payload.available);
      }
    };

    socket.on('chat:message', handleMessage);
    socket.on('chat:assigned', handleAssigned);
    socket.on('chat:availability', handlePresence);

    return () => {
      socket.off('chat:message', handleMessage);
      socket.off('chat:assigned', handleAssigned);
      socket.off('chat:availability', handlePresence);
      releaseChatSocket(audience);
    };
  }, [token, audience, enabled, describeMessage, onExtra]);

  const setAvailability = (available) => {
    const socket = acquireChatSocket(token, audience);
    socket.emit('chat:availability', { available }, (response) => {
      if (response?.ok) setIsAvailable(response.available);
    });
    releaseChatSocket(audience);
  };

  return { unreadCount, clearUnread: () => setUnreadCount(0), isAvailable, setAvailability };
};
