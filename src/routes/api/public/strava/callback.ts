import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/strava/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const code = url.searchParams.get("code");
        const state = url.searchParams.get("state");
        const error = url.searchParams.get("error");
        const scope = url.searchParams.get("scope") ?? "";
        const origin = url.origin;

        if (error) {
          return Response.redirect(`${origin}/app/perfil?strava=error&reason=${encodeURIComponent(error)}`, 302);
        }
        if (!code || !state) {
          return Response.redirect(`${origin}/app/perfil?strava=error&reason=missing_code`, 302);
        }

        const { verifyState, exchangeCode } = await import("@/lib/strava.server");
        const parsed = verifyState(state);
        if (!parsed) {
          return Response.redirect(`${origin}/app/perfil?strava=error&reason=invalid_state`, 302);
        }

        try {
          const tokens = await exchangeCode(code);
          if (!tokens.athlete?.id) throw new Error("Strava não retornou athlete.id");
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          await supabaseAdmin.from("strava_connections").upsert(
            {
              user_id: parsed.userId,
              strava_athlete_id: tokens.athlete.id,
              access_token: tokens.access_token,
              refresh_token: tokens.refresh_token,
              expires_at: new Date(tokens.expires_at * 1000).toISOString(),
              scope: scope || tokens.scope || null,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "user_id" },
          );
          return Response.redirect(`${origin}/app/perfil?strava=ok`, 302);
        } catch (e) {
          console.error("[strava/callback]", e);
          return Response.redirect(`${origin}/app/perfil?strava=error&reason=exchange_failed`, 302);
        }
      },
    },
  },
});
