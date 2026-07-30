import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { computeStreak, comparePeriods, type SetLite } from "@/lib/streak";
import { Flame, TrendingUp, TrendingDown, Minus, BarChart3 } from "lucide-react";

const DAY = 86400000;

/** Streak de treinos + resumo semanal/mensal com comparação ao período anterior. */
export function StreakSummaryCard({ userId }: { userId: string }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["streak-summary", userId],
    staleTime: 60_000,
    queryFn: async () => {
      const since = new Date(Date.now() - 200 * DAY).toISOString();
      const { data: sessions, error: sErr } = await supabase
        .from("sessions")
        .select("id, started_at, ended_at")
        .eq("user_id", userId)
        .gte("started_at", since)
        .order("started_at", { ascending: false });
      if (sErr) throw sErr;

      const recentIds = (sessions ?? [])
        .filter((s) => new Date(s.started_at).getTime() >= Date.now() - 70 * DAY)
        .map((s) => s.id);

      let sets: SetLite[] = [];
      if (recentIds.length) {
        const { data: setRows, error: setErr } = await supabase
          .from("session_sets")
          .select("session_id, weight_kg, reps")
          .in("session_id", recentIds);
        if (setErr) throw setErr;
        sets = (setRows ?? []) as SetLite[];
      }
      return { sessions: sessions ?? [], sets };
    },
  });

  const view = useMemo(() => {
    if (!data) return null;
    const streak = computeStreak(data.sessions);
    const week = comparePeriods(data.sessions as any, data.sets, 7);
    const month = comparePeriods(data.sessions as any, data.sets, 30);
    return { streak, week, month };
  }, [data]);

  if (isLoading || error || !view) return null;

  return (
    <section className="card-lift mt-4 p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand text-brand-foreground">
            <Flame className="size-5" strokeWidth={2.5} />
          </span>
          <div>
            <p className="text-eyebrow text-muted-foreground">Sequência</p>
            <p className="font-display text-xl font-black leading-tight">
              {view.streak.days} dia{view.streak.days === 1 ? "" : "s"} seguidos
            </p>
            <p className="text-xs text-muted-foreground">
              {view.streak.weeks} semana{view.streak.weeks === 1 ? "" : "s"} consecutiva
              {view.streak.weeks === 1 ? "" : "s"} · recorde {view.streak.bestDays} dias
            </p>
          </div>
        </div>
        <Link
          to="/app/volume"
          className="hidden shrink-0 items-center gap-1 rounded-full border border-border px-3 py-1.5 text-xs font-semibold hover:bg-muted sm:flex"
        >
          <BarChart3 className="size-3.5" />
          Volume
        </Link>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <SummaryBlock title="Últimos 7 dias" c={view.week} />
        <SummaryBlock title="Últimos 30 dias" c={view.month} />
      </div>
    </section>
  );
}

function SummaryBlock({
  title,
  c,
}: {
  title: string;
  c: ReturnType<typeof comparePeriods>;
}) {
  const Icon =
    c.deltaVolumePct == null ? Minus : c.deltaVolumePct > 0 ? TrendingUp : c.deltaVolumePct < 0 ? TrendingDown : Minus;
  const tone =
    c.deltaVolumePct == null || c.deltaVolumePct === 0
      ? "text-muted-foreground"
      : c.deltaVolumePct > 0
        ? "text-emerald-600 dark:text-emerald-400"
        : "text-amber-600 dark:text-amber-400";

  return (
    <div className="rounded-xl border border-border/70 bg-muted/30 p-3">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
      <p className="mt-1 font-display text-lg font-bold leading-none">
        {c.current.sessions} treino{c.current.sessions === 1 ? "" : "s"}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        {c.current.volume.toLocaleString("pt-BR")} kg · {c.current.sets} séries
      </p>
      <p className={`mt-1 flex items-center gap-1 text-[11px] font-medium ${tone}`}>
        <Icon className="size-3" />
        {c.deltaVolumePct == null
          ? "sem período anterior"
          : `${c.deltaVolumePct > 0 ? "+" : ""}${c.deltaVolumePct}% de volume · ${
              c.deltaSessions >= 0 ? "+" : ""
            }${c.deltaSessions} treino${Math.abs(c.deltaSessions) === 1 ? "" : "s"}`}
      </p>
    </div>
  );
}
