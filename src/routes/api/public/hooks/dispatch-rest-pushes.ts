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

        // Antecipação: o cron roda a cada minuto, então enviamos também os
        // descansos que vencem nos próximos 90s. O service worker recebe o
        // push, vê o `fireAt` no futuro e só exibe a notificação na hora
        // exata — assim o aviso chega no horário certo com a tela bloqueada.
        const lookaheadIso = new Date(Date.now() + 90 * 1000).toISOString();
        const { data: due, error } = await supabaseAdmin
          .from("rest_push_schedules")
          .select("id, user_id, title, body, fire_at")
          .is("sent_at", null)
          .lte("fire_at", lookaheadIso)
          .limit(200);

        if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });

        let sent = 0;
        let failed = 0;
        let deferred = 0;
        // iOS (Safari/WebKit) encerra o service worker de imediato depois do
        // push, então ele NÃO consegue segurar o aviso até a hora exata como
        // Android/Chrome. Para esses aparelhos só enviamos quando o descanso
        // já venceu — o worker exibe na mesma hora, sem atraso guardado.
        const isAppleSubscription = (ua: string | null) =>
          !!ua && /iPhone|iPad|iPod|Macintosh/i.test(ua) && !/Chrome|Android/i.test(ua);

        for (const row of due ?? []) {
          const fireAtMs = new Date(row.fire_at).getTime();
          const isDue = fireAtMs <= Date.now() + 1000;
          const { data: subs } = await supabaseAdmin
            .from("push_subscriptions")
            .select("id, endpoint, p256dh, auth, user_agent")
            .eq("user_id", row.user_id);
          const payload = JSON.stringify({
            title: row.title,
            body: row.body,
            tag: "rest-timer",
            data: {
              type: "rest-finished",
              scheduleId: row.id,
              fireAt: fireAtMs,
              url: "/",
            },
          });
          let pendingApple = false;
          for (const s of subs ?? []) {
            if (!isDue && isAppleSubscription(s.user_agent)) {
              // Ainda não venceu: espera a próxima passada do cron.
              pendingApple = true;
              deferred++;
              continue;
            }
            try {
              await webpush.sendNotification(
                { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
                payload,
                // TTL maior evita que o push seja descartado pelo servidor de
                // push quando o aparelho está sem rede por alguns minutos;
                // a urgência alta reduz o atraso em modo de economia/Doze.
                { TTL: 300, urgency: "high", topic: "resttimer" },
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
          // Só encerra o agendamento quando não restou nenhum aparelho Apple
          // aguardando o horário exato — assim o iPhone não fica sem aviso.
          if (!pendingApple) {
            await supabaseAdmin
              .from("rest_push_schedules")
              .update({ sent_at: new Date().toISOString() })
              .eq("id", row.id);
          }
        }


        // Limpa envios antigos (mais de 1 dia)
        await supabaseAdmin
          .from("rest_push_schedules")
          .delete()
          .lt("fire_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

        return Response.json({ processed: due?.length ?? 0, sent, failed, deferred });
      },
    },
  },
});
