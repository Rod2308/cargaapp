import { createFileRoute } from "@tanstack/react-router";

// Envia notificações Web Push da fila `push_outbox`. Rodado por pg_cron a cada minuto.
export const Route = createFileRoute("/api/public/hooks/dispatch-push-outbox")({
  server: {
    handlers: {
      POST: async () => {
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
          .from("push_outbox")
          .select("id, user_id, title, body, url, tag")
          .is("sent_at", null)
          .lte("fire_at", nowIso)
          .limit(500);
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
            tag: row.tag ?? `outbox:${row.id}`,
            data: { url: row.url ?? "/", outboxId: row.id },
          });
          for (const s of subs ?? []) {
            try {
              await webpush.sendNotification(
                { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
                payload,
                { TTL: 60 * 60 * 24 },
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
            .from("push_outbox")
            .update({ sent_at: new Date().toISOString() })
            .eq("id", row.id);
        }

        // Limpa itens antigos (>7 dias)
        await supabaseAdmin
          .from("push_outbox")
          .delete()
          .lt("fire_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

        return Response.json({ processed: due?.length ?? 0, sent, failed });
      },
    },
  },
});
