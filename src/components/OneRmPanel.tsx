import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Activity, ArrowDownRight, ArrowRight, ArrowUpRight, Calculator } from "lucide-react";
import {
  bestOneRm,
  estimateOneRm,
  nextSessionSuggestion,
  progressTrend,
  suggestLoads,
  weeklyProgression,
  type OneRmFormula,
  type OneRmSet,
} from "@/lib/one-rm";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function OneRmPanel({
  sets,
  exerciseName,
}: {
  sets: OneRmSet[];
  exerciseName: string;
}) {
  const [formula, setFormula] = useState<OneRmFormula>("epley");
  const [targetReps, setTargetReps] = useState<number>(8);

  const weeks = useMemo(() => weeklyProgression(sets, formula), [sets, formula]);
  const trend = useMemo(() => progressTrend(weeks), [weeks]);
  const allTime = useMemo(() => bestOneRm(sets, formula), [sets, formula]);
  const suggestions = useMemo(
    () => (trend.current ? suggestLoads(trend.current) : []),
    [trend.current],
  );
  const next = useMemo(() => nextSessionSuggestion(weeks, targetReps), [weeks, targetReps]);

  const bestSet = useMemo(() => {
    let best: { set: OneRmSet; e1rm: number } | null = null;
    for (const s of sets) {
      const e = estimateOneRm(s.weight_kg, s.reps, s.rpe, formula);
      if (e != null && (!best || e > best.e1rm)) best = { set: s, e1rm: e };
    }
    return best;
  }, [sets, formula]);

  const chart = useMemo(
    () =>
      weeks
        .filter((w) => w.e1rm != null)
        .slice(-12)
        .map((w) => ({
          semana: format(w.start, "dd/MM", { locale: ptBR }),
          "1RM": w.e1rm!,
          Volume: Math.round(w.volume),
        })),
    [weeks],
  );

  const TrendIcon =
    trend.direction === "up" ? ArrowUpRight : trend.direction === "down" ? ArrowDownRight : ArrowRight;

  return (
    <section className="card-lift mb-4 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Calculator className="h-4 w-4 text-primary" />
          <h2 className="font-display text-lg font-bold">1RM e progressão</h2>
        </div>
        <Select value={formula} onValueChange={(v) => setFormula(v as OneRmFormula)}>
          <SelectTrigger className="h-8 w-[150px] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="epley">Fórmula Epley</SelectItem>
            <SelectItem value="brzycki">Fórmula Brzycki</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {trend.current == null ? (
        <p className="text-sm text-muted-foreground">{trend.message}</p>
      ) : (
        <>
          <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Stat label="1RM estimado" value={`${trend.current.toFixed(1)} kg`} highlight />
            <Stat label="Recorde e1RM" value={allTime ? `${allTime.toFixed(1)} kg` : "—"} />
            <Stat
              label="vs. semana anterior"
              value={
                trend.deltaKg == null
                  ? "—"
                  : `${trend.deltaKg > 0 ? "+" : ""}${trend.deltaKg.toFixed(1)} kg`
              }
            />
            <Stat label="Semanas com dados" value={String(trend.weeks)} />
          </div>

          <div className="mb-3 flex items-start gap-2 rounded-lg border border-border/60 bg-muted/30 p-3">
            <TrendIcon
              className={`mt-0.5 h-4 w-4 shrink-0 ${
                trend.direction === "up"
                  ? "text-emerald-600 dark:text-emerald-400"
                  : trend.direction === "down"
                    ? "text-destructive"
                    : "text-muted-foreground"
              }`}
            />
            <div className="text-xs text-muted-foreground">
              <p className="font-semibold text-foreground">{trend.message}</p>
              {bestSet && (
                <p className="mt-0.5">
                  Melhor série: {bestSet.set.weight_kg ?? 0} kg × {bestSet.set.reps ?? 0}
                  {bestSet.set.rpe ? ` · RPE ${bestSet.set.rpe}` : ""} →{" "}
                  {bestSet.e1rm.toFixed(1)} kg de 1RM.
                </p>
              )}
            </div>
          </div>

          {chart.length > 1 && (
            <div className="mb-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                1RM estimado por semana (kg)
              </p>
              <div className="h-48 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chart} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                    <defs>
                      <linearGradient id="oneRmFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.35} />
                        <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                    <XAxis dataKey="semana" fontSize={11} />
                    <YAxis fontSize={11} domain={["auto", "auto"]} />
                    <Tooltip
                      contentStyle={{
                        background: "hsl(var(--background))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="1RM"
                      stroke="hsl(var(--primary))"
                      strokeWidth={2}
                      fill="url(#oneRmFill)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          <div className="mb-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Carga sugerida por faixa de repetições
            </p>
            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
              {suggestions.map((s) => (
                <button
                  key={s.reps}
                  type="button"
                  onClick={() => setTargetReps(s.reps)}
                  className={`flex items-center justify-between rounded-md border px-2 py-1.5 text-left text-xs transition ${
                    targetReps === s.reps
                      ? "border-primary bg-primary/10"
                      : "border-border/60 bg-muted/30 hover:bg-muted/60"
                  }`}
                >
                  <span className="text-muted-foreground">
                    {s.reps} reps
                    <span className="ml-1 opacity-70">{Math.round(s.percent * 100)}%</span>
                  </span>
                  <span className="font-semibold">{s.weight} kg</span>
                </button>
              ))}
            </div>
          </div>

          {next && (
            <div className="flex items-start gap-2 rounded-lg border border-primary/30 bg-primary/5 p-3">
              <Activity className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <div className="text-xs">
                <p className="font-display text-sm font-bold">
                  Próximo treino: {next.weight} kg × {targetReps} reps
                </p>
                <p className="text-muted-foreground">
                  {next.note} ({exerciseName})
                </p>
              </div>
            </div>
          )}

          <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
            Estimativas calculadas a partir das suas séries (com ajuste por RPE quando informado).
            Use como referência e valide com a execução real.
          </p>
        </>
      )}
    </section>
  );
}

function Stat({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border p-2 text-center ${
        highlight ? "border-primary/40 bg-primary/5" : "border-border/60 bg-muted/30"
      }`}
    >
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="font-display text-sm font-bold">{value}</p>
    </div>
  );
}
