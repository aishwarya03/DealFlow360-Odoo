// Which conversation (if any) currently has a visible ChatPanel, per browser
// tab. Lets useChatNotifications skip toasting/badging a message that's
// already appearing live in an open panel, without the two having to know
// about each other directly.
let activeConversationId = null;

export const setActiveConversationId = (id) => {
  activeConversationId = id;
};

export const getActiveConversationId = () => activeConversationId;
