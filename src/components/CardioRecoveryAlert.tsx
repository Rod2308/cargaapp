import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { computeCardioFatigue, type CardioLoad } from "@/lib/progression";
import { HeartPulse } from "lucide-react";
import { format, isToday, isYesterday } from "date-fns";
import { ptBR } from "date-fns/locale";

/**
 * Global alert: warns the user to reduce training intensity today when
 * an intense cardio session was imported yesterday or earlier today.
 * Looks at ALL imported cardio sessions (not just those linked to a workout).
 */
export function CardioRecoveryAlert({ userId }: { userId: string }) {
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

  if (loads.length === 0) return null;

  // Consider only sessions from yesterday or today for the "next day" reminder.
  const relevant = loads.filter((l) => {
    const d = new Date(l.started_at);
    return isToday(d) || isYesterday(d);
  });
  if (relevant.length === 0) return null;

  const fatigue = computeCardioFatigue(relevant as CardioLoad[]);
  if (fatigue.level === "none") return null;

  const isHigh = fatigue.level === "high";
  const last = relevant[0];
  const when = isToday(new Date(last.started_at))
    ? "hoje"
    : `ontem (${format(new Date(last.started_at), "HH:mm", { locale: ptBR })})`;

  return (
    <div
      className={`flex items-start gap-3 rounded-xl border p-3 ${
        isHigh ? "border-destructive/40 bg-destructive/10" : "border-amber-500/40 bg-amber-500/10"
      }`}
    >
      <HeartPulse className={`mt-0.5 size-4 shrink-0 ${isHigh ? "text-destructive" : "text-amber-600"}`} />
      <p className="min-w-0 flex-1 text-xs">
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
  );
}
