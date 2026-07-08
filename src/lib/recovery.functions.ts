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

export const getRecoveryAdvice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("IA indisponível.");
    const { supabase, userId } = context;

    const now = new Date();
    const since = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

    const [{ data: profile }, { data: sessions }] = await Promise.all([
      supabase
        .from("profiles")
        .select("display_name, experience_level, goal, uses_enhancers, weekly_frequency")
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
      for (const st of s.session_sets ?? []) {
        sets++;
        totalVolume += (Number(st.reps) || 0) * (Number(st.weight_kg) || 0);
        if (st.rpe) {
          avgRpe += Number(st.rpe);
          rpeCount++;
        }
        const mg = st.exercises?.muscle_group;
        if (mg) musclesMap.set(mg, (musclesMap.get(mg) ?? 0) + 1);
      }
      const muscles = Array.from(musclesMap.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([m, n]) => `${m}(${n})`)
        .join(", ");
      const daysAgo = Math.floor((now.getTime() - new Date(s.started_at).getTime()) / (24 * 60 * 60 * 1000));
      return `- há ${daysAgo}d: ${s.workouts?.label ?? "livre"} ${s.workouts?.name ?? ""} · ${sets} séries · vol ${Math.round(totalVolume)}kg · ${durationMin ? durationMin + " min" : "sem duração"} · esforço ${s.perceived_effort ?? "?"}${rpeCount ? " · RPE médio " + (avgRpe / rpeCount).toFixed(1) : ""} · músculos: ${muscles || "-"}`;
    });

    const sessionsThisWeek = sessions.filter(
      (s: any) => now.getTime() - new Date(s.started_at).getTime() < 7 * 24 * 60 * 60 * 1000,
    ).length;

    const { createLovableAiGatewayProvider } = await import("./ai-gateway.server");
    const gateway = createLovableAiGatewayProvider(key);

    const system = `Você é um coach de musculação especialista em recuperação e periodização, respondendo em português brasileiro.
Analise volume, frequência, esforço percebido (RPE) e grupos musculares treinados para decidir se o usuário está:
- "recuperado": pronto para treino pesado
- "leve": pode treinar, mas reduzir intensidade/volume
- "cuidado": sinais de fadiga, priorizar grupos não trabalhados ou treino leve
- "descanso": excesso de carga / overreaching → deve descansar hoje
Considere: >5 treinos em 7 dias sem folga = alerta; RPE médio >8.5 sustentado = fadiga; mesmo grupo muscular treinado sem 48h de intervalo = risco.
Para usuários avançados / com ergogênicos, tolere mais volume. Para iniciantes, seja mais conservador.
Seja direto, use tom motivador mas honesto.`;

    const prompt = `Perfil: ${profile?.experience_level ?? "iniciante"} · objetivo ${profile?.goal ?? "hipertrofia"} · ${profile?.weekly_frequency ?? "?"}x/semana · ${profile?.uses_enhancers ? "usa ergogênicos" : "natural"}
Treinos nos últimos 7 dias: ${sessionsThisWeek}
Últimas sessões (14 dias):
${summary.join("\n")}

Retorne JSON:
{
  "status": "recuperado" | "leve" | "cuidado" | "descanso",
  "headline": "frase curta (máx 6 palavras) — ex: 'Pronto pra treinar pesado' ou 'Hoje é dia de descanso'",
  "reason": "1-2 frases explicando com números concretos (ex: 'Você fez 5 treinos essa semana, RPE médio 9')",
  "recommendation": "1-2 frases com ação prática (ex: 'Vá de perna hoje, poupe peito', 'Descanse ou faça só cardio leve 20min')"
}`;

    try {
      const { output } = await generateText({
        model: gateway("google/gemini-3-flash-preview"),
        system,
        prompt,
        output: Output.object({ schema: RecoverySchema }),
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
