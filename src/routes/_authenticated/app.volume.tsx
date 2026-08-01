import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Route as AuthedRoute } from "./route";
import { EmptyState } from "@/components/EmptyState";
import { ListSkeleton } from "@/components/LoadingState";
import { ArrowLeft, BarChart3, AlertTriangle } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export const Route = createFileRoute("/_authenticated/app/volume")({
  component: WeeklyVolumePage,
  head: () => ({
    meta: [
      { title: "Volume semanal por grupo muscular · Carga" },
      {
        name: "description",
        content:
          "Veja quantas séries você fez por grupo muscular na semana e identifique músculos deixados para trás.",
      },
      { property: "og:title", content: "Volume semanal por grupo muscular · Carga" },
      {
        property: "og:description",
        content: "Séries e volume por grupo muscular, com comparação entre semanas.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type Row = {
  reps: number | null;
  weight_kg: number | null;
  completed_at: string;
  exercises: { muscle_group: string | null } | null;
  sessions: { started_at: string } | null;
};

import { weekStart } from "@/lib/week";

const DAY = 86400000;


// Domingo 00:00 no fuso do usuário.


function WeeklyVolumePage() {
  const { user } = AuthedRoute.useRouteContext();
  const [weeksBack, setWeeksBack] = useState(0);

  const { data: rows = [], isLoading, error } = useQuery({
    queryKey: ["weekly-volume", user.id],
    staleTime: 60_000,
    queryFn: async () => {
      const since = new Date(Date.now() - 84 * DAY).toISOString();
      const { data, error } = await supabase
        .from("session_sets")
        .select(
          "reps, weight_kg, completed_at, exercises(muscle_group), sessions!inner(started_at, user_id)",
        )
        .eq("sessions.user_id", user.id)
        .gte("completed_at", since)
        .order("completed_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Row[];
    },
  });

  const thisWeekStart = useMemo(() => {
    const base = weekStart(new Date());
    return new Date(base.getTime() - weeksBack * 7 * DAY);
  }, [weeksBack]);

  const buckets = useMemo(() => {
    const start = thisWeekStart.getTime();
    const end = start + 7 * DAY;
    const prevStart = start - 7 * DAY;

    const cur = new Map<string, { sets: number; volume: number; reps: number }>();
    const prev = new Map<string, { sets: number; volume: number }>();

    for (const r of rows) {
      const t = new Date(r.sessions?.started_at ?? r.completed_at).getTime();
      const group = r.exercises?.muscle_group?.trim() || "Sem grupo";
      const volume = (r.weight_kg ?? 0) * (r.reps ?? 0);
      if (t >= start && t < end) {
        const c = cur.get(group) ?? { sets: 0, volume: 0, reps: 0 };
        c.sets += 1;
        c.volume += volume;
        c.reps += r.reps ?? 0;
        cur.set(group, c);
      } else if (t >= prevStart && t < start) {
        const p = prev.get(group) ?? { sets: 0, volume: 0 };
        p.sets += 1;
        p.volume += volume;
        prev.set(group, p);
      }
    }

    const allGroups = new Set([...cur.keys(), ...prev.keys()]);
    const list = [...allGroups]
      .map((g) => {
        const c = cur.get(g) ?? { sets: 0, volume: 0, reps: 0 };
        const p = prev.get(g) ?? { sets: 0, volume: 0 };
        return {
          group: g,
          sets: c.sets,
          reps: c.reps,
          volume: Math.round(c.volume),
          prevSets: p.sets,
          deltaSets: c.sets - p.sets,
        };
      })
      .sort((a, b) => b.sets - a.sets || a.group.localeCompare(b.group, "pt-BR"));

    const maxSets = list.reduce((m, x) => Math.max(m, x.sets), 0);
    const totalSets = list.reduce((m, x) => m + x.sets, 0);
    const totalVolume = list.reduce((m, x) => m + x.volume, 0);
    // "Deixado para trás": treinou nas últimas semanas mas nada (ou quase) agora.
    const lagging = list.filter((x) => x.sets === 0 || (x.prevSets >= 4 && x.sets <= x.prevSets / 2));

    return { list, maxSets, totalSets, totalVolume, lagging };
  }, [rows, thisWeekStart]);

  const weekLabel = `${format(thisWeekStart, "dd MMM", { locale: ptBR })} – ${format(
    new Date(thisWeekStart.getTime() + 6 * DAY),
    "dd MMM",
    { locale: ptBR },
  )}`;

  return (
    <div className="mx-auto max-w-3xl px-4 pb-28 pt-6">
      <div className="mb-5 flex items-center gap-3">
        <Link to="/app" className="rounded-full border border-border p-2 hover:bg-muted" aria-label="Voltar">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="font-display text-2xl font-bold">Volume semanal</h1>
          <p className="text-sm text-muted-foreground">Séries por grupo muscular na semana.</p>
        </div>
      </div>

      <div className="card-lift mb-4 flex items-center justify-between gap-2 p-3">
        <button
          className="rounded-full border border-border px-3 py-1 text-sm hover:bg-muted"
          onClick={() => setWeeksBack((w) => Math.min(11, w + 1))}
        >
          ← Anterior
        </button>
        <div className="text-center">
          <p className="font-display text-sm font-bold">
            {weeksBack === 0 ? "Esta semana" : `${weeksBack} semana${weeksBack > 1 ? "s" : ""} atrás`}
          </p>
          <p className="text-xs text-muted-foreground">{weekLabel}</p>
        </div>
        <button
          className="rounded-full border border-border px-3 py-1 text-sm hover:bg-muted disabled:opacity-40"
          onClick={() => setWeeksBack((w) => Math.max(0, w - 1))}
          disabled={weeksBack === 0}
        >
          Próxima →
        </button>
      </div>

      {error ? (
        <EmptyState
          icon={BarChart3}
          title="Não consegui carregar o volume"
          message="Verifique sua conexão e tente novamente."
        />
      ) : isLoading ? (
        <ListSkeleton rows={4} />
      ) : buckets.totalSets === 0 ? (
        <EmptyState
          icon={BarChart3}
          title="Sem séries nesta semana"
          message="Registre treinos com séries para ver a distribuição por grupo muscular."
        />
      ) : (
        <>
          <div className="mb-4 grid grid-cols-2 gap-2">
            <div className="card-lift p-3 text-center">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Séries</p>
              <p className="font-display text-lg font-bold">{buckets.totalSets}</p>
            </div>
            <div className="card-lift p-3 text-center">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Volume</p>
              <p className="font-display text-lg font-bold">{buckets.totalVolume.toLocaleString("pt-BR")} kg</p>
            </div>
          </div>

          <div className="card-lift space-y-3 p-4">
            {buckets.list.map((g) => (
              <div key={g.group}>
                <div className="mb-1 flex items-baseline justify-between gap-2">
                  <span className="text-sm font-semibold capitalize">{g.group}</span>
                  <span className="text-xs text-muted-foreground">
                    {g.sets} série{g.sets === 1 ? "" : "s"} · {g.volume.toLocaleString("pt-BR")} kg
                    {g.prevSets > 0 && (
                      <>
                        {" · "}
                        <span className={g.deltaSets >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"}>
                          {g.deltaSets >= 0 ? "+" : ""}
                          {g.deltaSets} vs. semana passada
                        </span>
                      </>
                    )}
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${buckets.maxSets ? (g.sets / buckets.maxSets) * 100 : 0}%` }}
                  />
                </div>
              </div>
            ))}
          </div>

          {buckets.lagging.length > 0 && (
            <div className="card-lift mt-4 flex gap-3 p-4">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-500" />
              <div>
                <p className="text-sm font-semibold">Grupos ficando para trás</p>
                <p className="text-xs text-muted-foreground">
                  {buckets.lagging.map((g) => g.group).join(", ")} — você treinou bem menos (ou nada) nesta
                  semana comparado à anterior.
                </p>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
