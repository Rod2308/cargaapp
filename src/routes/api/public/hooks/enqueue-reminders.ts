import { createFileRoute } from "@tanstack/react-router";

// Enfileira lembretes de push para prazos de treino e eventos de desafio.
// Executado por pg_cron a cada ~10 minutos.
export const Route = createFileRoute("/api/public/hooks/enqueue-reminders")({
  server: {
    handlers: {
      POST: async () => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const now = new Date();
        const nowIso = now.toISOString();
        const in1hIso = new Date(now.getTime() + 60 * 60 * 1000).toISOString();
        const in24hIso = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();

        const rows: Array<{
          user_id: string;
          title: string;
          body: string;
          url: string;
          tag: string;
          fire_at: string;
        }> = [];

        // === Eventos de desafio (grupos) ===
        const { data: groups } = await supabaseAdmin
          .from("groups")
          .select("id, name, emoji, starts_at, ends_at")
          .is("archived_at", null);

        const relevant = (groups ?? []).filter((g) => {
          const startsSoon = g.starts_at && g.starts_at > nowIso && g.starts_at <= in1hIso;
          const endsSoon24 = g.ends_at && g.ends_at > nowIso && g.ends_at <= in24hIso;
          const endsSoon1 = g.ends_at && g.ends_at > nowIso && g.ends_at <= in1hIso;
          return startsSoon || endsSoon24 || endsSoon1;
        });

        for (const g of relevant) {
          const { data: members } = await supabaseAdmin
            .from("group_members")
            .select("user_id")
            .eq("group_id", g.id);
          const emoji = g.emoji ?? "🏆";
          for (const m of members ?? []) {
            if (g.starts_at && g.starts_at > nowIso && g.starts_at <= in1hIso) {
              rows.push({
                user_id: m.user_id,
                title: `${emoji} Desafio começando`,
                body: `${g.name} começa em breve. Bora treinar!`,
                url: `/app/grupos/${g.id}`,
                tag: `group-start-1h:${g.id}`,
                fire_at: nowIso,
              });
            }
            if (g.ends_at && g.ends_at > nowIso && g.ends_at <= in1hIso) {
              rows.push({
                user_id: m.user_id,
                title: `${emoji} Última hora do desafio`,
                body: `${g.name} termina em menos de 1h. Garanta seu check-in!`,
                url: `/app/grupos/${g.id}`,
                tag: `group-end-1h:${g.id}`,
                fire_at: nowIso,
              });
            } else if (g.ends_at && g.ends_at > nowIso && g.ends_at <= in24hIso) {
              rows.push({
                user_id: m.user_id,
                title: `${emoji} Desafio acaba amanhã`,
                body: `${g.name} termina em menos de 24h.`,
                url: `/app/grupos/${g.id}`,
                tag: `group-end-24h:${g.id}`,
                fire_at: nowIso,
              });
            }
          }
        }

        // === Lembrete diário de treino (19h America/Sao_Paulo) ===
        const spNow = new Date(
          now.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }),
        );
        const spHour = spNow.getHours();
        if (spHour === 19) {
          const spDate = spNow.toISOString().slice(0, 10);
          const startOfDay = new Date(spNow);
          startOfDay.setHours(0, 0, 0, 0);
          // volta para UTC
          const startUtc = new Date(
            startOfDay.getTime() - (spNow.getTime() - now.getTime()),
          ).toISOString();

          const { data: subs } = await supabaseAdmin
            .from("push_subscriptions")
            .select("user_id");
          const userIds = Array.from(new Set((subs ?? []).map((s) => s.user_id)));

          if (userIds.length > 0) {
            const { data: sessionsToday } = await supabaseAdmin
              .from("sessions")
              .select("user_id")
              .in("user_id", userIds)
              .gte("started_at", startUtc);
            const trained = new Set((sessionsToday ?? []).map((s) => s.user_id));
            for (const uid of userIds) {
              if (trained.has(uid)) continue;
              rows.push({
                user_id: uid,
                title: "💪 Hora do treino",
                body: "Você ainda não registrou treino hoje. Bora?",
                url: "/app",
                tag: `workout-reminder:${spDate}`,
                fire_at: nowIso,
              });
            }
          }
        }

        // Upsert dedupado via índice único parcial (user_id, tag) WHERE sent_at IS NULL
        let inserted = 0;
        for (const r of rows) {
          const { error } = await supabaseAdmin.from("push_outbox").insert(r);
          if (!error) inserted++;
        }

        return Response.json({ candidates: rows.length, inserted });
      },
    },
  },
});
