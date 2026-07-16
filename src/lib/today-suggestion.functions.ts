import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { generateText } from "ai";

export type TodaySuggestion = {
  muscle_groups: string;
  workout_type: string;
  intensity: "leve" | "moderada" | "alta" | "descanso";
  justification: string;
  full_text: string;
  model: string;
};

const INTENSITY_MAP: Record<string, TodaySuggestion["intensity"]> = {
  leve: "leve",
  moderada: "moderada",
  moderado: "moderada",
  alta: "alta",
  descanso: "descanso",
};

function parseIntensity(raw: string): TodaySuggestion["intensity"] {
  const lower = raw.toLowerCase();
  for (const key of Object.keys(INTENSITY_MAP)) {
    if (lower.includes(key)) return INTENSITY_MAP[key];
  }
  return "moderada";
}

export const suggestTodayWorkout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<TodaySuggestion> => {
    const { supabase, userId } = context;

    const sinceIso = new Date(Date.now() - 7 * 86400_000).toISOString();
    const sinceDate = new Date(Date.now() - 7 * 86400_000).toISOString().slice(0, 10);

    const [profileRes, sessionsRes, sleepRes] = await Promise.all([
      supabase
        .from("profiles")
        .select("display_name, experience_level, goal, weekly_frequency, sex, injuries")
        .eq("id", userId)
        .maybeSingle(),
      supabase
        .from("sessions")
        .select(
          "id, started_at, ended_at, perceived_effort, notes, avg_hr, max_hr, distance_m, activity_type, workouts(name, label), session_sets(reps, weight_kg, rpe, exercises(name, muscle_group))",
        )
        .eq("user_id", userId)
        .gte("started_at", sinceIso)
        .order("started_at", { ascending: false })
        .limit(15),
      supabase
        .from("sleep_logs")
        .select("log_date, hours, quality, notes")
        .eq("user_id", userId)
        .gte("log_date", sinceDate)
        .order("log_date", { ascending: false }),
    ]);

    const profile = profileRes.data;
    const sessions = sessionsRes.data ?? [];
    const sleep = sleepRes.data ?? [];

    // Build a compact history summary
    const sessionLines = sessions.map((s: any) => {
      const date = new Date(s.started_at).toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" });
      const dur = s.ended_at ? Math.round((new Date(s.ended_at).getTime() - new Date(s.started_at).getTime()) / 60000) : null;
      const groups = new Set<string>();
      const sets = s.session_sets ?? [];
      for (const st of sets) {
        const g = st.exercises?.muscle_group;
        if (g) groups.add(g);
      }
      const rpes = sets.map((x: any) => x.rpe).filter((v: any) => typeof v === "number");
      const avgRpe = rpes.length ? (rpes.reduce((a: number, b: number) => a + b, 0) / rpes.length).toFixed(1) : null;
      const parts = [
        date,
        s.workouts?.label ? `${s.workouts.label} (${s.workouts.name})` : s.activity_type ?? "sessão",
        groups.size ? `grupos: ${Array.from(groups).join(", ")}` : null,
        sets.length ? `${sets.length} séries` : null,
        avgRpe ? `RPE~${avgRpe}` : null,
        s.perceived_effort ? `esforço ${s.perceived_effort}/10` : null,
        dur ? `${dur}min` : null,
        s.avg_hr ? `FC média ${s.avg_hr}` : null,
        s.max_hr ? `FC máx ${s.max_hr}` : null,
      ].filter(Boolean);
      return `- ${parts.join(" · ")}`;
    });

    // Compute rest days in last 7 days
    const trainedDays = new Set(sessions.map((s: any) => new Date(s.started_at).toISOString().slice(0, 10)));
    const restDaysInWeek = 7 - trainedDays.size;

    // Days since last session per muscle group
    const now = Date.now();
    const lastByGroup = new Map<string, number>();
    for (const s of sessions) {
      const t = new Date(s.started_at).getTime();
      for (const st of s.session_sets ?? []) {
        const g = st.exercises?.muscle_group;
        if (!g) continue;
        if (!lastByGroup.has(g) || lastByGroup.get(g)! < t) lastByGroup.set(g, t);
      }
    }
    const groupRest = Array.from(lastByGroup.entries())
      .map(([g, t]) => `${g}: há ${Math.floor((now - t) / 86400_000)}d`)
      .join(" · ");

    const sleepLines = sleep.map((s: any) => `- ${s.log_date}: ${s.hours}h${s.quality ? ` · qualidade ${s.quality}/5` : ""}`);
    const sleepAvg = sleep.length ? sleep.reduce((a: number, s: any) => a + Number(s.hours), 0) / sleep.length : null;
    const lastNight = sleep[0];
    const shortNights = sleep.filter((s: any) => Number(s.hours) < 6).length;

    const system = `Você é um assistente de treino especializado em periodização e recuperação muscular.
Sua tarefa é analisar os dados do usuário e sugerir o treino ideal para HOJE.
Se houver sinais claros de overtraining ou sono insuficiente por 2+ noites seguidas (<6h), priorize descanso ativo ou completo — mesmo que quebre a sequência planejada.
Linguagem direta, motivadora, sem jargão excessivo — como um personal trainer dando um conselho rápido antes do treino.

Responda em português brasileiro, EXATAMENTE neste formato Markdown (mantenha os títulos):

**Grupo(s) muscular(es):** <resposta curta>
**Tipo de treino:** <força / hipertrofia / resistência / mobilidade / descanso ativo / descanso total>
**Intensidade:** <leve / moderada / alta / descanso>

**Por quê:** <2-3 frases citando os dados que embasaram a decisão (sono, dias sem treinar aquele grupo, RPE, FC, etc.)>`;

    const userMsg = `PERFIL
- Nome: ${profile?.display_name ?? "-"} · Sexo: ${profile?.sex ?? "-"}
- Nível: ${profile?.experience_level ?? "-"} · Objetivo: ${profile?.goal ?? "-"}
- Frequência semanal alvo: ${profile?.weekly_frequency ?? "-"} dias
- Lesões: ${profile?.injuries?.trim() || "nenhuma"}

HISTÓRICO ÚLTIMOS 7 DIAS (${sessions.length} sessões · ${restDaysInWeek} dias sem treinar)
${sessionLines.join("\n") || "- nenhuma sessão registrada"}

TEMPO DESDE ÚLTIMO TREINO POR GRUPO
${groupRest || "- sem dados"}

SONO ÚLTIMAS ${sleep.length} NOITES${sleepAvg ? ` (média ${sleepAvg.toFixed(1)}h)` : ""}${shortNights >= 2 ? ` · ⚠️ ${shortNights} noites <6h` : ""}
${sleepLines.join("\n") || "- sem registros"}
Última noite: ${lastNight ? `${lastNight.hours}h${lastNight.quality ? ` · qualidade ${lastNight.quality}/5` : ""}` : "não registrada"}

Hoje é ${new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })}. Sugira o treino ideal.`;

    const { createConfiguredAiModel, getAiFallbackMessage } = await import("./ai-gateway.server");
    const ai = createConfiguredAiModel({ lovableModel: "google/gemini-3.5-flash" });

    try {
      const { text } = await generateText({
        model: ai.model,
        system,
        prompt: userMsg,
        maxRetries: 2,
      });
      const full = text.trim();

      const grab = (label: string) => {
        const re = new RegExp(`\\*\\*${label}[^*]*\\*\\*\\s*:?\\s*([^\\n]+)`, "i");
        return full.match(re)?.[1]?.trim() ?? "";
      };
      const muscle = grab("Grupo") || "—";
      const workoutType = grab("Tipo de treino") || "—";
      const intensityRaw = grab("Intensidade") || "moderada";
      const justification = grab("Por quê") || full;

      return {
        muscle_groups: muscle,
        workout_type: workoutType,
        intensity: parseIntensity(intensityRaw),
        justification,
        full_text: full,
        model: ai.modelId,
      };
    } catch (error) {
      return {
        muscle_groups: "—",
        workout_type: "—",
        intensity: "moderada",
        justification: getAiFallbackMessage(error, "gerar a sugestão de hoje"),
        full_text: getAiFallbackMessage(error, "gerar a sugestão de hoje"),
        model: ai.modelId,
      };
    }
  });
