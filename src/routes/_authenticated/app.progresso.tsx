import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Route as AuthedRoute } from "./route";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { ArrowLeft, TrendingUp, Trophy, Dumbbell } from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/progresso")({
  component: ProgressPage,
});

type SetRow = {
  id: string;
  reps: number | null;
  weight_kg: number | null;
  rpe: number | null;
  completed_at: string;
  exercise_id: string;
  session_id: string;
  exercises: { name: string; muscle_group: string | null } | null;
  sessions: { started_at: string } | null;
};

function ProgressPage() {
  const { user } = AuthedRoute.useRouteContext();
  const [selected, setSelected] = useState<string | null>(null);

  const { data: sets = [], isLoading } = useQuery({
    queryKey: ["progress-sets", user.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("session_sets")
        .select(
          "id, reps, weight_kg, rpe, completed_at, exercise_id, session_id, exercises(name, muscle_group), sessions!inner(started_at, user_id)"
        )
        .eq("sessions.user_id", user.id)
        .order("completed_at", { ascending: true });
      return (data ?? []) as unknown as SetRow[];
    },
  });

  const byExercise = useMemo(() => {
    const m = new Map<
      string,
      { id: string; name: string; muscle: string | null; sets: SetRow[] }
    >();
    for (const s of sets) {
      if (!s.exercises) continue;
      const cur = m.get(s.exercise_id) ?? {
        id: s.exercise_id,
        name: s.exercises.name,
        muscle: s.exercises.muscle_group,
        sets: [],
      };
      cur.sets.push(s);
      m.set(s.exercise_id, cur);
    }
    return Array.from(m.values()).sort((a, b) =>
      a.name.localeCompare(b.name, "pt-BR")
    );
  }, [sets]);

  const current = useMemo(() => {
    if (!byExercise.length) return null;
    const id = selected ?? byExercise[0].id;
    return byExercise.find((e) => e.id === id) ?? byExercise[0];
  }, [byExercise, selected]);

  const grouped = useMemo(() => {
    if (!current) return [];
    const days = new Map<
      string,
      { date: string; sets: SetRow[] }
    >();
    for (const s of current.sets) {
      const d = (s.sessions?.started_at ?? s.completed_at).slice(0, 10);
      const cur = days.get(d) ?? { date: d, sets: [] };
      cur.sets.push(s);
      days.set(d, cur);
    }
    return Array.from(days.values()).sort((a, b) =>
      b.date.localeCompare(a.date)
    );
  }, [current]);

  const chart = useMemo(() => {
    return grouped
      .slice()
      .reverse()
      .map((d) => {
        const maxW = d.sets.reduce(
          (m, s) => Math.max(m, s.weight_kg ?? 0),
          0
        );
        const totalVol = d.sets.reduce(
          (m, s) => m + (s.weight_kg ?? 0) * (s.reps ?? 0),
          0
        );
        const maxReps = d.sets.reduce(
          (m, s) => Math.max(m, s.reps ?? 0),
          0
        );
        return {
          date: format(new Date(d.date + "T12:00:00"), "dd/MM"),
          Carga: Number(maxW.toFixed(1)),
          Volume: Number(totalVol.toFixed(0)),
          Reps: maxReps,
        };
      });
  }, [grouped]);

  const prs = useMemo(() => {
    if (!current) return { maxWeight: 0, maxReps: 0, maxVolume: 0 };
    let maxWeight = 0;
    let maxReps = 0;
    for (const s of current.sets) {
      if ((s.weight_kg ?? 0) > maxWeight) maxWeight = s.weight_kg ?? 0;
      if ((s.reps ?? 0) > maxReps) maxReps = s.reps ?? 0;
    }
    const maxVolume = chart.reduce((m, d) => Math.max(m, d.Volume), 0);
    return { maxWeight, maxReps, maxVolume };
  }, [current, chart]);

  return (
    <div className="mx-auto max-w-3xl px-4 pb-24 pt-6">
      <div className="mb-6 flex items-center gap-3">
        <Link
          to="/app"
          className="rounded-full border border-border p-2 hover:bg-muted"
          aria-label="Voltar"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="font-display text-2xl font-bold">Progresso por exercício</h1>
          <p className="text-sm text-muted-foreground">
            Histórico de cargas e repetições ao longo dos treinos.
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="card-lift p-6 text-sm text-muted-foreground">Carregando…</div>
      ) : byExercise.length === 0 ? (
        <div className="card-lift p-6 text-center">
          <Dumbbell className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Registre séries com carga e repetições nas sessões para ver seu progresso aqui.
          </p>
        </div>
      ) : (
        <>
          <div className="mb-4">
            <Select
              value={current?.id}
              onValueChange={(v) => setSelected(v)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Escolha um exercício" />
              </SelectTrigger>
              <SelectContent>
                {byExercise.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.name}
                    {e.muscle ? ` · ${e.muscle}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {current && (
            <>
              {/* PRs */}
              <div className="mb-4 grid grid-cols-3 gap-2">
                <PrCard
                  icon={<Trophy className="h-4 w-4" />}
                  label="Carga máx"
                  value={prs.maxWeight ? `${prs.maxWeight} kg` : "—"}
                />
                <PrCard
                  icon={<TrendingUp className="h-4 w-4" />}
                  label="Reps máx"
                  value={prs.maxReps ? String(prs.maxReps) : "—"}
                />
                <PrCard
                  icon={<Dumbbell className="h-4 w-4" />}
                  label="Volume máx"
                  value={prs.maxVolume ? `${prs.maxVolume} kg` : "—"}
                />
              </div>

              {/* Chart */}
              {chart.length > 1 && (
                <div className="card-lift mb-4 p-4">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Evolução da carga máxima (kg)
                  </p>
                  <div className="h-56 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chart} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                        <XAxis dataKey="date" fontSize={11} />
                        <YAxis fontSize={11} />
                        <Tooltip
                          contentStyle={{
                            background: "hsl(var(--background))",
                            border: "1px solid hsl(var(--border))",
                            borderRadius: 8,
                            fontSize: 12,
                          }}
                        />
                        <Line
                          type="monotone"
                          dataKey="Carga"
                          stroke="hsl(var(--primary))"
                          strokeWidth={2}
                          dot={{ r: 3 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {/* History timeline */}
              <div className="space-y-3">
                <h2 className="font-display text-lg font-bold">Histórico por dia</h2>
                {grouped.map((day) => {
                  const dayMaxWeight = day.sets.reduce(
                    (m, s) => Math.max(m, s.weight_kg ?? 0),
                    0
                  );
                  const dayVolume = day.sets.reduce(
                    (m, s) => m + (s.weight_kg ?? 0) * (s.reps ?? 0),
                    0
                  );
                  const isPR = dayMaxWeight > 0 && dayMaxWeight === prs.maxWeight;
                  return (
                    <div key={day.date} className="card-lift p-4">
                      <div className="mb-2 flex items-center justify-between">
                        <div>
                          <p className="font-display text-sm font-bold">
                            {format(new Date(day.date + "T12:00:00"), "EEE, dd MMM yyyy", {
                              locale: ptBR,
                            })}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {day.sets.length} série{day.sets.length > 1 ? "s" : ""} · Vol {dayVolume.toFixed(0)} kg
                          </p>
                        </div>
                        {isPR && (
                          <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-600 dark:text-amber-400">
                            🏆 PR
                          </span>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                        {day.sets
                          .slice()
                          .sort((a, b) => a.completed_at.localeCompare(b.completed_at))
                          .map((s, i) => (
                            <div
                              key={s.id}
                              className="flex items-center justify-between rounded-md border border-border/60 bg-muted/30 px-2 py-1 text-xs"
                            >
                              <span className="text-muted-foreground">#{i + 1}</span>
                              <span className="font-semibold">
                                {s.weight_kg ?? 0}kg × {s.reps ?? 0}
                                {s.rpe ? ` · RPE ${s.rpe}` : ""}
                              </span>
                            </div>
                          ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

function PrCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="card-lift p-3 text-center">
      <div className="mb-1 flex items-center justify-center gap-1 text-muted-foreground">
        {icon}
        <span className="text-[10px] font-semibold uppercase tracking-wide">{label}</span>
      </div>
      <p className="font-display text-base font-bold">{value}</p>
    </div>
  );
}
