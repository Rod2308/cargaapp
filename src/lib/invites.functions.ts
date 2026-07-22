import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const InputSchema = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9-]{4,12}$/),
});

export type PublicInvite = {
  name: string;
  description: string | null;
  emoji: string | null;
  member_count: number;
  is_archived: boolean;
} | null;

export const getPublicInvite = createServerFn({ method: "GET" })
  .inputValidator((data) => InputSchema.parse(data))
  .handler(async ({ data }): Promise<PublicInvite> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin.rpc("get_group_public_invite", {
      _code: data.code,
    });
    if (error) return null;
    const row = Array.isArray(rows) ? rows[0] : rows;
    if (!row) return null;
    return {
      name: row.name,
      description: row.description,
      emoji: row.emoji,
      member_count: Number(row.member_count ?? 0),
      is_archived: !!row.is_archived,
    };
  });
