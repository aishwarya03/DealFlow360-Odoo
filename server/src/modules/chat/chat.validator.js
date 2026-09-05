import { z } from 'zod';

// Messages themselves travel over the socket (chat:message), not REST — this
// is the one payload REST still needs, for adding a collaborator.
export const addParticipantSchema = z.object({
  userId: z.number().int().positive(),
});
