import { createClient } from "@supabase/supabase-js";
import type { ToolContext } from "@lovable.dev/mcp-js";

/**
 * Supabase client scoped to the MCP caller's user session.
 *
 * Notes:
 * - New-format `sb_publishable_*` keys are opaque, not JWTs. If both
 *   `apikey` and `Authorization: Bearer <sb_...>` are sent, PostgREST tries
 *   to decode the bearer as a JWT and fails with
 *   `Expected 3 parts in JWT; got 1`. When we're using an sb_ key, we send
 *   the caller's own user token as the bearer (which IS a JWT) and only
 *   the anon key as `apikey`.
 */
export function supabaseForUser(ctx: ToolContext) {
  const url = process.env.SUPABASE_URL!;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY!;
  const userToken = ctx.getToken();

  return createClient(url, key, {
    global: {
      fetch: (input, init) => {
        const headers = new Headers(init?.headers);
        // apikey is always the anon key
        headers.set("apikey", key);
        // Authorization is the user's JWT — never the opaque sb_ key
        if (userToken) headers.set("Authorization", `Bearer ${userToken}`);
        else headers.delete("Authorization");
        return fetch(input, { ...init, headers });
      },
    },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function unauthorized() {
  return {
    content: [{ type: "text" as const, text: "Não autenticado." }],
    isError: true,
  };
}
