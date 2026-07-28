import { createFileRoute } from "@tanstack/react-router";

// Enfileira lembretes de push para prazos de treino e eventos de desafio.
// Executado por pg_cron a cada ~10 minutos.
export const Route = createFileRoute("/api/public/hooks/enqueue-reminders")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { isAuthorizedCronRequest, cronUnauthorized } = await import("@/lib/cron-auth.server");
        if (!isAuthorizedCronRequest(request)) return cronUnauthorized();

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

        // === Lembrete diário de treino (por preferência do usuário) ===
        const { data: subs } = await supabaseAdmin
          .from("push_subscriptions")
          .select("user_id");
        const userIds = Array.from(new Set((subs ?? []).map((s) => s.user_id)));

        if (userIds.length > 0) {
          const { data: settingsRows } = await supabaseAdmin
            .from("workout_reminder_settings")
            .select("user_id, enabled, remind_at, rest_days, timezone")
            .in("user_id", userIds);
          const settingsByUser = new Map(
            (settingsRows ?? []).map((r) => [r.user_id, r]),
          );

          // Janela de disparo: o cron roda a cada ~10min.
          const WINDOW_MIN = 10;
          const candidates: { userId: string; localDate: string }[] = [];

          for (const uid of userIds) {
            const s = settingsByUser.get(uid);
            const enabled = s ? s.enabled : true;
            if (!enabled) continue;
            const tz = s?.timezone || "America/Sao_Paulo";
            const remindAt = String(s?.remind_at ?? "09:00").slice(0, 5);
            const restDays = (s?.rest_days ?? []) as number[];

            let parts: Intl.DateTimeFormatPart[];
            try {
              parts = new Intl.DateTimeFormat("en-CA", {
                timeZone: tz,
                year: "numeric",
                month: "2-digit",
                day: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
                weekday: "short",
                hour12: false,
              }).formatToParts(now);
            } catch {
              continue;
            }
            const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
            const localDate = `${get("year")}-${get("month")}-${get("day")}`;
            const localMinutes = Number(get("hour")) * 60 + Number(get("minute"));
            const weekdayMap: Record<string, number> = {
              Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
            };
            const weekday = weekdayMap[get("weekday")];
            if (restDays.includes(weekday)) continue;

            const [hh, mm] = remindAt.split(":").map(Number);
            const target = hh * 60 + mm;
            const diff = localMinutes - target;
            if (diff < 0 || diff >= WINDOW_MIN) continue;

            candidates.push({ userId: uid, localDate });
          }

          if (candidates.length > 0) {
            // Não avisa quem já registrou treino hoje (últimas 24h cobre o dia local).
            const since = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
            const { data: recentSessions } = await supabaseAdmin
              .from("sessions")
              .select("user_id, started_at")
              .in("user_id", candidates.map((c) => c.userId))
              .gte("started_at", since);
            const trained = new Set((recentSessions ?? []).map((s) => s.user_id));

            for (const c of candidates) {
              if (trained.has(c.userId)) continue;
              rows.push({
                user_id: c.userId,
                title: "💪 Lembrete de treino",
                body: "Seu treino de hoje está esperando por você!",
                url: "/app",
                tag: `workout-reminder:${c.localDate}`,
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
