import { createServerFn } from "@tanstack/react-start";

export type PublicInvite = {
  name: string;
  description: string | null;
  emoji: string | null;
  member_count: number;
  is_archived: boolean;
} | null;

export const getPublicInvite = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => data)
  .handler(async ({ data }): Promise<PublicInvite> => {
    const { getPublicInviteAction } = await import("./bridge-actions.server");
    return getPublicInviteAction(data);
  });
