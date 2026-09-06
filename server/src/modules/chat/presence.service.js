// In-memory only — fine at single-process scale, and it must be: presence is
// "does this process currently hold an open socket for this user", which is
// meaningless to persist. A rep is online for exactly as long as the internal
// app has a live Socket.IO connection open (see realtime/socket.js).
//
// Value is a Set of socket ids, not a boolean, so a rep with two tabs open
// doesn't get marked offline the moment they close one of them.
const onlineReps = new Map();

// A rep can flip this on manually (e.g. stepping into a meeting) without
// closing the app — separate from onlineReps because it must survive across
// tabs/reconnects the same session did, and clear itself the moment every
// socket for that rep is actually gone, not linger from a stale toggle.
const awayReps = new Set();
const onlineCustomers = new Map();
const awayCustomers = new Set();

export const markOnline = (userId, socketId) => {
  if (!onlineReps.has(userId)) onlineReps.set(userId, new Set());
  onlineReps.get(userId).add(socketId);
};

export const markOffline = (userId, socketId) => {
  const sockets = onlineReps.get(userId);
  if (!sockets) return;
  sockets.delete(socketId);
  if (sockets.size === 0) {
    onlineReps.delete(userId);
    // A fresh login should start "available" again, not resume whatever the
    // last session left the toggle at.
    awayReps.delete(userId);
  }
};

export const setAway = (userId, away) => {
  if (away) awayReps.add(userId);
  else awayReps.delete(userId);
};

export const isAway = (userId) => awayReps.has(userId);

// "Online" for routing purposes means reachable AND willing — connected but
// marked Away is deliberately excluded here, not just from the UI list.
export const isRepOnline = (userId) => onlineReps.has(userId) && !awayReps.has(userId);

export const listOnlineRepIds = () => [...onlineReps.keys()].filter((id) => !awayReps.has(id));

export const markCustomerOnline = (userId, socketId) => {
  if (!onlineCustomers.has(userId)) onlineCustomers.set(userId, new Set());
  onlineCustomers.get(userId).add(socketId);
};

export const markCustomerOffline = (userId, socketId) => {
  const sockets = onlineCustomers.get(userId);
  if (!sockets) return;
  sockets.delete(socketId);
  if (sockets.size === 0) {
    onlineCustomers.delete(userId);
    awayCustomers.delete(userId);
  }
};

export const setCustomerAway = (userId, away) => {
  if (away) awayCustomers.add(userId);
  else awayCustomers.delete(userId);
};

export const isCustomerOnline = (userId) => onlineCustomers.has(userId) && !awayCustomers.has(userId);
