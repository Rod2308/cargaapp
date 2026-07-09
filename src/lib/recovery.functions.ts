import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { generateText, Output, NoObjectGeneratedError } from "ai";
import { z } from "zod";

const RecoverySchema = z.object({
  status: z.enum(["recuperado", "leve", "cuidado", "descanso"]),
  headline: z.string(),
  reason: z.string(),
  recommendation: z.string(),
});

export type RecoveryAdvice = z.infer<typeof RecoverySchema>;

const RECOVERY_GOOGLE_MODEL = "gemini-flash-latest";
const RECOVERY_LOVABLE_MODEL = "google/gemini-3-flash-preview";

export const getRecoveryAdvice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const now = new Date();
    const since = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
    const sleepSince = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [{ data: profile }, { data: sessions }, { data: sleep }] = await Promise.all([
      supabase
        .from("profiles")
        .select("display_name, experience_level, goal, uses_enhancers, weekly_frequency, sex, birth_date, height_cm, weight_kg, activity_level, injuries")
        .eq("id", userId)
        .maybeSingle(),

      supabase
        .from("sessions")
        .select(
          "id, started_at, ended_at, perceived_effort, notes, workouts(label, name), session_sets(reps, weight_kg, rpe, exercises(name, muscle_group))",
        )
        .eq("user_id", userId)
        .gte("started_at", since.toISOString())
        .order("started_at", { ascending: false })
        .limit(20),
      supabase
        .from("sleep_logs")
        .select("log_date, hours, quality")
        .eq("user_id", userId)
        .gte("log_date", sleepSince.toISOString().slice(0, 10))
        .order("log_date", { ascending: false }),
    ]);

    // Se não há treinos nos últimos 14 dias, resposta local (sem IA)
    if (!sessions || sessions.length === 0) {
      return {
        status: "recuperado" as const,
        headline: "Você está recuperado",
        reason: "Sem treinos registrados nas últimas 2 semanas.",
        recommendation: "Bora começar! Escolha um treino e mande ver com carga moderada.",
      };
    }

    // Resumo dos treinos para a IA
    const summary = sessions.map((s: any) => {
      const durationMin = s.ended_at
        ? Math.round((new Date(s.ended_at).getTime() - new Date(s.started_at).getTime()) / 60000)
        : null;
      const musclesMap = new Map<string, number>();
      let totalVolume = 0;
      let sets = 0;
      let avgRpe = 0;
      let rpeCount = 0;
      let sportMinutes = 0;
      const sportsList = new Set<string>();
      for (const st of s.session_sets ?? []) {
        const mg = st.exercises?.muscle_group;
        const isSport = mg === "Esportes";
        if (isSport) {
          // Em esportes: reps = minutos, sem carga
          sportMinutes += Number(st.reps) || 0;
          if (st.exercises?.name) sportsList.add(st.exercises.name);
        } else {
          sets++;
          totalVolume += (Number(st.reps) || 0) * (Number(st.weight_kg) || 0);
        }
        if (st.rpe) {
          avgRpe += Number(st.rpe);
          rpeCount++;
        }
        if (mg) musclesMap.set(mg, (musclesMap.get(mg) ?? 0) + 1);
      }
      const muscles = Array.from(musclesMap.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([m, n]) => `${m}(${n})`)
        .join(", ");
      const daysAgo = Math.floor((now.getTime() - new Date(s.started_at).getTime()) / (24 * 60 * 60 * 1000));
      const sportPart = sportMinutes > 0
        ? ` · esporte ${sportMinutes}min (${Array.from(sportsList).join("/")})`
        : "";
      return `- há ${daysAgo}d: ${s.workouts?.label ?? "livre"} ${s.workouts?.name ?? ""} · ${sets} séries · vol ${Math.round(totalVolume)}kg${sportPart} · ${durationMin ? durationMin + " min total" : "sem duração"} · esforço ${s.perceived_effort ?? "?"}${rpeCount ? " · RPE médio " + (avgRpe / rpeCount).toFixed(1) : ""} · músculos: ${muscles || "-"}`;
    });

    const sessionsThisWeek = sessions.filter(
      (s: any) => now.getTime() - new Date(s.started_at).getTime() < 7 * 24 * 60 * 60 * 1000,
    ).length;

    // Sono últimos 7 dias
    const sleepArr = (sleep ?? []) as { log_date: string; hours: number; quality: number | null }[];
    const sleepAvg =
      sleepArr.length > 0
        ? sleepArr.reduce((a, s) => a + Number(s.hours), 0) / sleepArr.length
        : null;
    const qualArr = sleepArr.filter((s) => s.quality != null);
    const qualityAvg =
      qualArr.length > 0
        ? qualArr.reduce((a, s) => a + Number(s.quality), 0) / qualArr.length
        : null;
    const lastNight = sleepArr[0]?.hours ?? null;
    const sleepSummary = sleepArr.length
      ? `média ${sleepAvg!.toFixed(1)}h em ${sleepArr.length} noites${qualityAvg ? `, qualidade média ${qualityAvg.toFixed(1)}/5` : ""}${lastNight != null ? `, última noite ${lastNight}h` : ""}`
      : "sem registros de sono";

    const { createConfiguredAiModel } = await import("./ai-gateway.server");
    const ai = createConfiguredAiModel({
      googleModel: RECOVERY_GOOGLE_MODEL,
      lovableModel: RECOVERY_LOVABLE_MODEL,
    });

    const system = `Você é um coach de musculação especialista em recuperação e periodização, respondendo em português brasileiro.
Analise volume, frequência, esforço percebido (RPE), grupos musculares treinados E SONO para decidir se o usuário está:
- "recuperado": pronto para treino pesado
- "leve": pode treinar, mas reduzir intensidade/volume
- "cuidado": sinais de fadiga, priorizar grupos não trabalhados ou treino leve
- "descanso": excesso de carga / overreaching / privação de sono → deve descansar hoje
Considere: >5 treinos em 7 dias sem folga = alerta; RPE médio >8.5 sustentado = fadiga; mesmo grupo muscular treinado sem 48h de intervalo = risco.
ESPORTES (futebol, vôlei, corrida etc — grupo "Esportes", medidos em minutos) somam carga cardiovascular/sistêmica e fadiga de MMII: >90min de esporte intenso nas últimas 48h ou esporte + treino de perna no mesmo/dia seguinte = fadiga acumulada, reduzir volume de pernas/glúteos; contam também na contagem semanal de "treinos".
SONO é decisivo para recuperação: <6h médias ou última noite <5h = reduzir intensidade ou descansar; 6-7h = treino leve/moderado; 7-9h = ideal; qualidade baixa (≤2/5) sustentada = alerta.
Para usuários avançados / com ergogênicos, tolere mais volume. Para iniciantes, seja mais conservador. Ajuste também para idade (>40 anos: janela de recuperação maior), sexo, IMC e nível de atividade diária fora do treino. Considere lesões/limitações para sugerir grupos alternativos.
Seja direto, cite números concretos do sono e dos esportes quando relevante, use tom motivador mas honesto.`;

    const recAge = profile?.birth_date
      ? (() => {
          const b = new Date(profile.birth_date);
          const n = new Date();
          let a = n.getFullYear() - b.getFullYear();
          const m = n.getMonth() - b.getMonth();
          if (m < 0 || (m === 0 && n.getDate() < b.getDate())) a--;
          return a;
        })()
      : null;

    const prompt = `Perfil: ${profile?.experience_level ?? "iniciante"} · objetivo ${profile?.goal ?? "hipertrofia"} · ${profile?.weekly_frequency ?? "?"}x/semana · ${profile?.uses_enhancers ? "usa ergogênicos" : "natural"}
Antropometria: ${profile?.sex ?? "-"}, ${recAge ?? "-"} anos, ${profile?.height_cm ?? "-"}cm, ${profile?.weight_kg ?? "-"}kg · atividade fora do treino: ${profile?.activity_level ?? "-"}
Lesões / limitações: ${profile?.injuries?.trim() || "nenhuma"}
Sono (últimos 7 dias): ${sleepSummary}
Treinos nos últimos 7 dias: ${sessionsThisWeek}
Últimas sessões (14 dias):
${summary.join("\n")}

Retorne JSON:
{
  "status": "recuperado" | "leve" | "cuidado" | "descanso",
  "headline": "frase curta (máx 6 palavras) — ex: 'Pronto pra treinar pesado' ou 'Sono baixo, vá leve'",
  "reason": "1-2 frases com números concretos incluindo sono quando afetar (ex: 'Dormiu média 5.2h e fez 4 treinos essa semana')",
  "recommendation": "1-2 frases com ação prática (ex: 'Vá de perna hoje, poupe peito', 'Priorize dormir 8h e faça só cardio leve')"
}`;

    try {
      const { output } = await generateText({
        model: ai.model,
        system,
        prompt,
        output: Output.object({ schema: RecoverySchema }),
        maxRetries: 0,
      });
      return output;
    } catch (error) {
      if (NoObjectGeneratedError.isInstance(error) && error.text) {
        const match = error.text.match(/\{[\s\S]*\}/);
        if (match) {
          try {
            return RecoverySchema.parse(JSON.parse(match[0]));
          } catch {}
        }
      }
      // Fallback silencioso
      return {
        status: "leve" as const,
        headline: "Escute seu corpo",
        reason: `${sessionsThisWeek} treino(s) essa semana.`,
        recommendation: "Se ainda sente dor muscular forte, priorize um treino mais leve hoje.",
      };
    }
  });
