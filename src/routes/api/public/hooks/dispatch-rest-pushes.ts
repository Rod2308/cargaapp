import { createFileRoute } from "@tanstack/react-router";

// Envia notificações Web Push cujas datas de disparo já passaram.
// Chamado por pg_cron a cada minuto. Latência de até ~60s é esperada.
export const Route = createFileRoute("/api/public/hooks/dispatch-rest-pushes")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { isAuthorizedCronRequest, cronUnauthorized } = await import("@/lib/cron-auth.server");
        if (!isAuthorizedCronRequest(request)) return cronUnauthorized();

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const webpush = (await import("web-push")).default;

        const subject = process.env.VAPID_SUBJECT;
        const publicKey = process.env.VAPID_PUBLIC_KEY;
        const privateKey = process.env.VAPID_PRIVATE_KEY;
        if (!subject || !publicKey || !privateKey) {
          return new Response(JSON.stringify({ error: "VAPID keys missing" }), { status: 500 });
        }
        webpush.setVapidDetails(subject, publicKey, privateKey);

        const nowIso = new Date().toISOString();
        const { data: due, error } = await supabaseAdmin
          .from("rest_push_schedules")
          .select("id, user_id, title, body, fire_at")
          .is("sent_at", null)
          .lte("fire_at", nowIso)
          .limit(200);
        if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });

        let sent = 0;
        let failed = 0;
        for (const row of due ?? []) {
          const { data: subs } = await supabaseAdmin
            .from("push_subscriptions")
            .select("id, endpoint, p256dh, auth")
            .eq("user_id", row.user_id);
          const payload = JSON.stringify({
            title: row.title,
            body: row.body,
            tag: "rest-timer",
            data: { type: "rest-finished", scheduleId: row.id },
          });
          for (const s of subs ?? []) {
            try {
              await webpush.sendNotification(
                { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
                payload,
                { TTL: 60 },
              );
              sent++;
            } catch (err: unknown) {
              failed++;
              const statusCode = (err as { statusCode?: number })?.statusCode;
              if (statusCode === 404 || statusCode === 410) {
                await supabaseAdmin.from("push_subscriptions").delete().eq("id", s.id);
              }
            }
          }
          await supabaseAdmin
            .from("rest_push_schedules")
            .update({ sent_at: new Date().toISOString() })
            .eq("id", row.id);
        }

        // Limpa envios antigos (mais de 1 dia)
        await supabaseAdmin
          .from("rest_push_schedules")
          .delete()
          .lt("fire_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

        return Response.json({ processed: due?.length ?? 0, sent, failed });
      },
    },
  },
});
