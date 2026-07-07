import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { generateText } from "ai";
import { z } from "zod";

const CoachInput = z.object({
  question: z.string().min(1).max(500),
});

export const askCoach = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => CoachInput.parse(input))
  .handler(async ({ data, context }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Coach indisponível: chave da IA ausente.");

    const { supabase, userId } = context;

    // Perfil
    const { data: profile } = await supabase
      .from("profiles")
      .select("display_name, experience_level, goal, uses_enhancers, weekly_frequency")
      .eq("id", userId)
      .maybeSingle();

    // Últimas 5 sessões
    const { data: sessions } = await supabase
      .from("sessions")
      .select("started_at, ended_at, perceived_effort, workouts(name, label)")
      .eq("user_id", userId)
      .order("started_at", { ascending: false })
      .limit(5);

    // Treinos do usuário
    const { data: workouts } = await supabase
      .from("workouts")
      .select("label, name, notes, workout_exercises(target_sets, target_reps, target_weight_kg, target_rest_seconds, exercises(name, muscle_group))")
      .eq("user_id", userId);

    const { createLovableAiGatewayProvider } = await import("./ai-gateway.server");
    const gateway = createLovableAiGatewayProvider(key);

    const system = `Você é um coach de musculação experiente, direto e motivador, respondendo em português brasileiro.
Baseie sugestões em ciência do treinamento: princípio da sobrecarga progressiva, ajuste de descanso conforme intensidade (hipertrofia 60-90s, força 2-4min, resistência 30-45s), split adequado à frequência semanal, e alerta para overtraining.
Se o usuário mencionar uso de recursos ergogênicos (esteroides / SARMs), aumente o volume e a frequência com responsabilidade e recomende acompanhamento médico.
Responda em no máximo 6 frases, use bullets quando fizer sentido, e cite números concretos (kg, reps, séries, min de descanso).`;

    const context_text = `Perfil do usuário:
- Nome: ${profile?.display_name ?? "-"}
- Nível: ${profile?.experience_level ?? "iniciante"}
- Objetivo: ${profile?.goal ?? "hipertrofia"}
- Frequência semanal: ${profile?.weekly_frequency ?? "-"} dias
- Usa recursos ergogênicos: ${profile?.uses_enhancers ? "sim" : "não"}

Treinos cadastrados: ${workouts?.map((w: any) => `${w.label} (${w.name}) — ${w.workout_exercises?.length ?? 0} exercícios`).join("; ") || "nenhum"}

Últimas sessões: ${sessions?.map((s: any) => `${s.workouts?.label ?? "?"} em ${new Date(s.started_at).toLocaleDateString("pt-BR")} (esforço ${s.perceived_effort ?? "?"})`).join("; ") || "nenhuma"}

Pergunta: ${data.question}`;

    const { text } = await generateText({
      model: gateway("google/gemini-3-flash-preview"),
      system,
      prompt: context_text,
    });

    return { answer: text };
  });
