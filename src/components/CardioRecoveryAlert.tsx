import { useMemo, useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { computeCardioFatigue, type CardioLoad } from "@/lib/progression";
import { HeartPulse, Loader2, Check } from "lucide-react";
import { format, isToday, isYesterday } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

/**
 * Global alert: warns the user to reduce training intensity today when
 * an intense cardio session was imported yesterday or earlier today.
 * Also offers a one-click apply that lowers load and bumps rest across
 * the user's workout_exercises for the next session.
 */
export function CardioRecoveryAlert({ userId }: { userId: string }) {
  const qc = useQueryClient();
  const { data: loads = [] } = useQuery({
    queryKey: ["cardio-recovery-alert", userId],
    queryFn: async (): Promise<(CardioLoad & { started_at: string })[]> => {
      const since = new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString();
      const { data } = await supabase
        .from("sessions")
        .select("started_at, ended_at, avg_hr, max_hr, calories, distance_m, activity_type")
        .eq("user_id", userId)
        .neq("source", "manual")
        .gte("started_at", since)
        .order("started_at", { ascending: false });
      return (data ?? []) as any;
    },
  });

  const relevant = useMemo(
    () =>
      loads.filter((l) => {
        const d = new Date(l.started_at);
        return isToday(d) || isYesterday(d);
      }),
    [loads],
  );
  const fatigue = useMemo(() => computeCardioFatigue(relevant as CardioLoad[]), [relevant]);

  const appliedKey = `cardio-recovery-applied:${userId}:${new Date().toISOString().slice(0, 10)}:${fatigue.level}`;
  const [applied, setApplied] = useState(false);
  useEffect(() => {
    if (typeof window !== "undefined") setApplied(!!localStorage.getItem(appliedKey));
  }, [appliedKey]);

  const apply = useMutation({
    mutationFn: async () => {
      const isHigh = fatigue.level === "high";
      const restBump = isHigh ? 30 : 15;
      const loadFactor = isHigh ? 0.95 : 1;

      // Fetch all workout_exercises for this user's workouts.
      const { data: workouts, error: wErr } = await supabase
        .from("workouts")
        .select("id")
        .eq("user_id", userId);
      if (wErr) throw wErr;
      const workoutIds = (workouts ?? []).map((w) => w.id);
      if (workoutIds.length === 0) return { count: 0 };

      const { data: wex, error: eErr } = await supabase
        .from("workout_exercises")
        .select("id, target_weight_kg, target_rest_seconds")
        .in("workout_id", workoutIds);
      if (eErr) throw eErr;

      const updates = (wex ?? []).map((row) => {
        const newRest = Math.min(240, (row.target_rest_seconds ?? 90) + restBump);
        const newWeight =
          isHigh && row.target_weight_kg != null && row.target_weight_kg > 0
            ? Math.round((Number(row.target_weight_kg) * loadFactor) / 2.5) * 2.5
            : row.target_weight_kg;
        return supabase
          .from("workout_exercises")
          .update({ target_rest_seconds: newRest, target_weight_kg: newWeight })
          .eq("id", row.id);
      });
      const results = await Promise.all(updates);
      const failed = results.find((r) => r.error);
      if (failed?.error) throw failed.error;
      return { count: updates.length };
    },
    onSuccess: ({ count }) => {
      localStorage.setItem(appliedKey, "1");
      setApplied(true);
      qc.invalidateQueries({ queryKey: ["workout"] });
      qc.invalidateQueries({ queryKey: ["workouts"] });
      toast.success(
        fatigue.level === "high"
          ? `Ajustado: -5% carga e +30s descanso em ${count} exercício(s).`
          : `Ajustado: +15s descanso em ${count} exercício(s).`,
      );
    },
    onError: (e: any) => toast.error(e.message ?? "Falha ao aplicar ajuste"),
  });

  if (loads.length === 0 || relevant.length === 0 || fatigue.level === "none") return null;

  const isHigh = fatigue.level === "high";
  const last = relevant[0];
  const when = isToday(new Date(last.started_at))
    ? "hoje"
    : `ontem (${format(new Date(last.started_at), "HH:mm", { locale: ptBR })})`;

  return (
    <div
      className={`flex flex-col gap-3 rounded-xl border p-3 sm:flex-row sm:items-start ${
        isHigh ? "border-destructive/40 bg-destructive/10" : "border-amber-500/40 bg-amber-500/10"
      }`}
    >
      <HeartPulse className={`mt-0.5 size-4 shrink-0 ${isHigh ? "text-destructive" : "text-amber-600"}`} />
      <div className="min-w-0 flex-1">
        <p className="text-xs">
          <span className="font-semibold text-foreground">
            {isHigh ? "Reduza a intensidade hoje" : "Atenção com a intensidade"}
          </span>
          <span className="text-muted-foreground">
            {" "}
            · Cardio {when}: {fatigue.summary?.toLowerCase() ?? "carga acumulada"}.{" "}
            {isHigh
              ? "Considere diminuir carga, séries ou trocar por um treino leve."
              : "Priorize recuperação entre séries."}
          </span>
        </p>
      </div>
      <Button
        size="sm"
        variant={isHigh ? "destructive" : "outline"}
        disabled={apply.isPending || applied}
        onClick={() => apply.mutate()}
        className="shrink-0"
      >
        {apply.isPending ? (
          <><Loader2 className="size-3.5 animate-spin" /> Aplicando...</>
        ) : applied ? (
          <><Check className="size-3.5" /> Aplicado</>
        ) : isHigh ? (
          "Aplicar -5% carga · +30s"
        ) : (
          "Aplicar +15s descanso"
        )}
      </Button>
    </div>
  );
}
