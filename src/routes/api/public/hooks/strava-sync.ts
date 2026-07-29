import { createFileRoute } from "@tanstack/react-router";

// Sincronização periódica das atividades do Strava para todos os usuários conectados.
// Chamado por pg_cron a cada 30 minutos. Idempotente: usa last_sync_at como cursor delta.

export const Route = createFileRoute("/api/public/hooks/strava-sync")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { isAuthorizedCronRequest, cronUnauthorized } = await import("@/lib/cron-auth.server");
        if (!isAuthorizedCronRequest(request)) return cronUnauthorized();

        const started = Date.now();
        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const {
            getValidAccessTokenForUser,
            listActivitiesSince,
            upsertActivityForUser,
          } = await import("@/lib/strava.server");

          const { data: conns, error } = await supabaseAdmin
            .from("strava_connections")
            .select("user_id, last_sync_at");
          if (error) throw error;

          let usersProcessed = 0;
          let inserted = 0;
          let updated = 0;
          let skipped = 0;
          const errors: Array<{ user_id: string; message: string }> = [];

          // O parâmetro `after` do Strava filtra pela DATA DE INÍCIO da atividade,
          // não pela data de upload. Como o upload costuma acontecer bem depois do
          // treino (às vezes horas), usar só o cursor last_sync_at faz a atividade
          // nunca entrar na janela. Por isso olhamos sempre pelo menos 3 dias para trás.
          const nowSec = Math.floor(Date.now() / 1000);
          const MIN_LOOKBACK_SEC = 3 * 24 * 3600;

          for (const c of conns ?? []) {
            const userId = c.user_id as string;
            const lastSyncSec = c.last_sync_at
              ? Math.floor(new Date(c.last_sync_at as string).getTime() / 1000)
              : nowSec - MIN_LOOKBACK_SEC;
            // Cursor com folga de 5 min, mas nunca menor que a janela mínima.
            const afterUnix = Math.max(0, Math.min(lastSyncSec - 5 * 60, nowSec - MIN_LOOKBACK_SEC));


            try {
              const token = await getValidAccessTokenForUser(userId);
              if (!token) {
                skipped++;
                continue;
              }
              const list = await listActivitiesSince(token, afterUnix);
              for (const a of list) {
                try {
                  const r = await upsertActivityForUser(userId, a.id);
                  if (r === "inserted") inserted++;
                  else if (r === "updated") updated++;
                  else skipped++;
                } catch {
                  skipped++;
                }
              }
              await supabaseAdmin
                .from("strava_connections")
                .update({ last_sync_at: new Date().toISOString() })
                .eq("user_id", userId);
              usersProcessed++;
            } catch (e) {
              const message = e instanceof Error ? e.message : String(e);
              errors.push({ user_id: userId, message });
              console.error("[strava-sync] user failed", userId, message);
            }
          }

          const elapsedMs = Date.now() - started;
          console.log(
            `[strava-sync] users=${usersProcessed} ins=${inserted} upd=${updated} skip=${skipped} err=${errors.length} ${elapsedMs}ms`,
          );
          return Response.json({
            ok: true,
            usersProcessed,
            inserted,
            updated,
            skipped,
            errors,
            elapsedMs,
          });
        } catch (e) {
          const message = e instanceof Error ? e.message : String(e);
          console.error("[strava-sync] fatal", message);
          return Response.json({ ok: false, error: message }, { status: 500 });
        }
      },
    },
  },
});
