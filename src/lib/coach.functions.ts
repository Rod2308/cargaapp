import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { generateText, Output, NoObjectGeneratedError } from "ai";
import { z } from "zod";

const CoachInput = z.object({
  question: z.string().min(1).max(500),
});

export const askCoach = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => CoachInput.parse(input))
  .handler(async ({ data, context }) => {
    const key = process.env.GEMINI_API_KEY;
    if (!key) throw new Error("Coach indisponível: chave do Gemini ausente.");

    const { supabase, userId } = context;

    const { data: profile } = await supabase
      .from("profiles")
      .select("display_name, experience_level, goal, uses_enhancers, weekly_frequency, sex, birth_date, height_cm, weight_kg, activity_level, injuries")
      .eq("id", userId)
      .maybeSingle();

    const age = profile?.birth_date
      ? (() => {
          const b = new Date(profile.birth_date);
          const n = new Date();
          let a = n.getFullYear() - b.getFullYear();
          const m = n.getMonth() - b.getMonth();
          if (m < 0 || (m === 0 && n.getDate() < b.getDate())) a--;
          return a;
        })()
      : null;
    const bmi =
      profile?.height_cm && profile?.weight_kg
        ? (Number(profile.weight_kg) / Math.pow(Number(profile.height_cm) / 100, 2)).toFixed(1)
        : null;


    const { data: sessions } = await supabase
      .from("sessions")
      .select("started_at, ended_at, perceived_effort, workouts(name, label)")
      .eq("user_id", userId)
      .order("started_at", { ascending: false })
      .limit(5);

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
- Sexo: ${profile?.sex ?? "-"} · Idade: ${age ?? "-"}${age != null ? " anos" : ""}
- Altura: ${profile?.height_cm ?? "-"}${profile?.height_cm ? " cm" : ""} · Peso: ${profile?.weight_kg ?? "-"}${profile?.weight_kg ? " kg" : ""}${bmi ? ` · IMC ${bmi}` : ""}
- Nível: ${profile?.experience_level ?? "iniciante"}
- Objetivo: ${profile?.goal ?? "hipertrofia"}
- Atividade diária fora do treino: ${profile?.activity_level ?? "-"}
- Frequência semanal: ${profile?.weekly_frequency ?? "-"} dias
- Usa recursos ergogênicos: ${profile?.uses_enhancers ? "sim" : "não"}
- Lesões / limitações: ${profile?.injuries?.trim() || "nenhuma informada"}


Treinos cadastrados: ${workouts?.map((w: any) => `${w.label} (${w.name}) — ${w.workout_exercises?.length ?? 0} exercícios`).join("; ") || "nenhum"}

Últimas sessões: ${sessions?.map((s: any) => `${s.workouts?.label ?? "?"} em ${new Date(s.started_at).toLocaleDateString("pt-BR")} (esforço ${s.perceived_effort ?? "?"})`).join("; ") || "nenhuma"}

Pergunta: ${data.question}`;

    const { text } = await generateText({
      model: gateway("gemini-flash-latest"),
      system,
      prompt: context_text,
    });

    return { answer: text };
  });

// ============================================================
// Gerar plano de treino personalizado com IA
// ============================================================

const PlanInput = z.object({
  goal: z.string().min(1).max(80),
  days_per_week: z.number().int().min(1).max(7),
  experience: z.enum(["iniciante", "intermediario", "avancado"]),
  session_minutes: z.number().int().min(20).max(180).default(60),
  equipment: z.string().max(200).optional(),
  focus: z.string().max(200).optional(),
  uses_enhancers: z.boolean().default(false),
  replace_existing: z.boolean().default(false),
  for_user_id: z.string().uuid().optional(),
});

const PlanSchema = z.object({
  overview: z.string(),
  splits: z.array(
    z.object({
      label: z.string(),
      name: z.string(),
      notes: z.string(),
      exercises: z.array(
        z.object({
          name: z.string(),
          muscle_group: z.string(),
          sets: z.number(),
          reps: z.string(),
          rest_seconds: z.number(),
        }),
      ),
    }),
  ),
});

export const generatePlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => PlanInput.parse(input))
  .handler(async ({ data, context }) => {
    const key = process.env.GEMINI_API_KEY;
    if (!key) throw new Error("Coach indisponível: chave do Gemini ausente.");
    const { supabase, userId } = context;

    // Se `for_user_id` foi passado, o professor está gerando para um aluno.
    // Valida vínculo e usa o id do aluno como alvo.
    const targetUserId = data.for_user_id ?? userId;
    const trainerId = data.for_user_id ? userId : null;
    if (data.for_user_id && data.for_user_id !== userId) {
      const { data: linked } = await supabase.rpc("is_trainer_of", {
        _trainer: userId,
        _student: data.for_user_id,
      });
      if (!linked) throw new Error("Você não é professor deste aluno.");
    }

    const { data: userProfile } = await supabase
      .from("profiles")
      .select("sex, birth_date, height_cm, weight_kg, activity_level, injuries")
      .eq("id", targetUserId)
      .maybeSingle();

    const planAge = userProfile?.birth_date
      ? (() => {
          const b = new Date(userProfile.birth_date);
          const n = new Date();
          let a = n.getFullYear() - b.getFullYear();
          const m = n.getMonth() - b.getMonth();
          if (m < 0 || (m === 0 && n.getDate() < b.getDate())) a--;
          return a;
        })()
      : null;

    // Biblioteca de exercícios disponível
    const { data: exercisesLib } = await supabase
      .from("exercises")
      .select("id, name, muscle_group, equipment")
      .order("muscle_group")
      .order("name");

    const libByName = new Map<string, { id: string; muscle_group: string }>();
    for (const e of exercisesLib ?? []) libByName.set(e.name.toLowerCase(), { id: e.id, muscle_group: e.muscle_group });

    const catalog = (exercisesLib ?? [])
      .map((e) => `- ${e.name} [${e.muscle_group}${e.equipment ? ` · ${e.equipment}` : ""}]`)
      .join("\n");


    const { createLovableAiGatewayProvider } = await import("./ai-gateway.server");
    const gateway = createLovableAiGatewayProvider(key);

    const system = `Você é um coach profissional de musculação com base em ciência do treinamento (princípios de Schoenfeld, ACSM, NSCA).
Monte um plano REAL e efetivo, com séries, repetições e descanso adequados ao objetivo:
- Hipertrofia: 3-4 séries, 8-12 reps, descanso 60-90s.
- Força: 4-6 séries, 3-6 reps, descanso 120-240s.
- Resistência: 2-3 séries, 15-20 reps, descanso 30-45s.
- Emagrecimento: circuitos, 12-15 reps, descanso 30-60s, inclua cardio.
Divida a semana de forma equilibrada:
- 2 dias: full-body A/B.
- 3 dias: push/pull/legs OU A/B/C.
- 4 dias: upper/lower A/B OU A/B/C/D com dia de foco.
- 5 dias: PPL + upper + lower OU divisão por grupo.
- 6 dias: PPL x2 (com ajuste de intensidade).
Para usuários de ergogênicos, aumente volume (5-6 séries por exercício, 20+ séries por grupo muscular/semana).
Cada treino deve ter 5-8 exercícios, começando por multiarticulares (compostos) e terminando em isoladores.
Use APENAS exercícios da biblioteca fornecida — copie o nome EXATAMENTE. Responda em português brasileiro.`;

    const equipment = data.equipment?.trim() || "academia completa";
    const focus = data.focus?.trim() ? `\n- Foco especial: ${data.focus.trim()}` : "";

    const prompt = `Monte um plano semanal com ${data.days_per_week} treino(s) para:
- Objetivo: ${data.goal}
- Nível: ${data.experience}
- Sexo: ${userProfile?.sex ?? "-"} · Idade: ${planAge ?? "-"}
- Altura: ${userProfile?.height_cm ?? "-"} cm · Peso: ${userProfile?.weight_kg ?? "-"} kg
- Atividade diária fora do treino: ${userProfile?.activity_level ?? "-"}
- Lesões / limitações: ${userProfile?.injuries?.trim() || "nenhuma"} (EVITE exercícios que agravem essas áreas; sugira variações seguras)
- Duração por sessão: ${data.session_minutes} minutos
- Equipamento disponível: ${equipment}
- Usa ergogênicos: ${data.uses_enhancers ? "sim (aumente volume)" : "não"}${focus}


Rotule os treinos como A, B, C, D, E, F ou G conforme a quantidade de dias.
Cada treino: nome curto descritivo (ex: "Peito e tríceps"), notas breves com dicas, e lista de exercícios.

BIBLIOTECA DE EXERCÍCIOS DISPONÍVEIS (use somente destes, copiando o nome exatamente):
${catalog}

Retorne JSON no formato:
{
  "overview": "resumo em 2-3 frases explicando a lógica do split",
  "splits": [
    {
      "label": "A",
      "name": "Peito e tríceps",
      "notes": "Foco em volume, cadência controlada.",
      "exercises": [
        { "name": "Supino reto barra", "muscle_group": "Peito", "sets": 4, "reps": "8-10", "rest_seconds": 90 }
      ]
    }
  ]
}`;

    let plan: z.infer<typeof PlanSchema>;
    try {
      const { output } = await generateText({
        model: gateway("gemini-flash-latest"),
        system,
        prompt,
        output: Output.object({ schema: PlanSchema }),
      });
      plan = output;
    } catch (error: any) {
      // Créditos da IA esgotados / limite de uso
      const status = error?.statusCode ?? error?.status ?? error?.response?.status;
      const msg = String(error?.message ?? "");
      if (status === 402 || status === 429 || /payment required|quota|credit|insufficient/i.test(msg)) {
        throw new Error(
          "Os créditos de IA acabaram. Use a opção 'Novo treino manual' para montar e enviar o treino ao aluno — vai direto, sem IA.",
        );
      }
      if (NoObjectGeneratedError.isInstance(error) && error.text) {
        const match = error.text.match(/\{[\s\S]*\}/);
        if (!match) throw new Error("A IA não devolveu um plano válido. Tente novamente.");
        plan = PlanSchema.parse(JSON.parse(match[0]));
      } else {
        throw error;
      }
    }


    if (!plan.splits.length) throw new Error("A IA não gerou nenhum treino.");

    // Se o usuário optou por substituir, apaga treinos existentes
    if (data.replace_existing) {
      await supabase.from("workouts").delete().eq("user_id", targetUserId);
    }

    // Descobre próximo order_idx
    const { data: existing } = await supabase
      .from("workouts")
      .select("order_idx")
      .eq("user_id", targetUserId)
      .order("order_idx", { ascending: false })
      .limit(1);
    let nextIdx = (existing?.[0]?.order_idx ?? -1) + 1;

    const created: { id: string; label: string; name: string }[] = [];

    for (const split of plan.splits) {
      const { data: w, error: werr } = await supabase
        .from("workouts")
        .insert({
          user_id: targetUserId,
          label: (split.label || "?").slice(0, 3).toUpperCase(),
          name: split.name.slice(0, 80),
          notes: split.notes?.slice(0, 400) ?? null,
          order_idx: nextIdx++,
          created_by_trainer_id: trainerId,
        })
        .select("id, label, name")
        .single();
      if (werr || !w) throw new Error(`Falha ao criar treino: ${werr?.message}`);
      created.push(w);

      for (let i = 0; i < split.exercises.length; i++) {
        const ex = split.exercises[i];
        let hit = libByName.get(ex.name.toLowerCase());
        if (!hit) {
          // Cria exercício custom se a IA inventou algo fora da lib
          const { data: newEx } = await supabase
            .from("exercises")
            .insert({
              name: ex.name.slice(0, 100),
              muscle_group: ex.muscle_group?.slice(0, 40) || "Outros",
              is_default: false,
              created_by: userId,
            })
            .select("id, muscle_group")
            .single();
          if (!newEx) continue;
          hit = { id: newEx.id, muscle_group: newEx.muscle_group };
          libByName.set(ex.name.toLowerCase(), hit);
        }
        await supabase.from("workout_exercises").insert({
          workout_id: w.id,
          exercise_id: hit.id,
          order_idx: i,
          target_sets: Math.max(1, Math.min(10, Math.round(ex.sets || 3))),
          target_reps: String(ex.reps || "10").slice(0, 20),
          target_rest_seconds: Math.max(15, Math.min(600, Math.round(ex.rest_seconds || 90))),
        });
      }
    }

    // Só atualiza o perfil quando o próprio usuário está gerando pra si
    if (!data.for_user_id) {
      await supabase
        .from("profiles")
        .update({
          goal: data.goal,
          weekly_frequency: data.days_per_week,
          experience_level: data.experience,
          uses_enhancers: data.uses_enhancers,
        })
        .eq("id", userId);
    }

    return { overview: plan.overview, workouts: created };
  });

