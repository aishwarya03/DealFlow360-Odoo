// In-memory only — fine at single-process scale, and it must be: presence is
// "does this process currently hold an open socket for this user", which is
// meaningless to persist. A rep is online for exactly as long as the internal
// app has a live Socket.IO connection open (see realtime/socket.js).
//
// Value is a Set of socket ids, not a boolean, so a rep with two tabs open
// doesn't get marked offline the moment they close one of them.
const onlineReps = new Map();

export const markOnline = (userId, socketId) => {
  if (!onlineReps.has(userId)) onlineReps.set(userId, new Set());
  onlineReps.get(userId).add(socketId);
};

export const markOffline = (userId, socketId) => {
  const sockets = onlineReps.get(userId);
  if (!sockets) return;
  sockets.delete(socketId);
  if (sockets.size === 0) onlineReps.delete(userId);
};

export const isRepOnline = (userId) => onlineReps.has(userId);

export const listOnlineRepIds = () => [...onlineReps.keys()];
