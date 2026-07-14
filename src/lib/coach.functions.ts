import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { generateText, Output, NoObjectGeneratedError, tool, stepCountIs } from "ai";
import { z } from "zod";


const CoachInput = z.object({
  question: z.string().min(1).max(500),
});

export const pingGemini = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const started = Date.now();
    const { createConfiguredAiModel, getAiFallbackMessage } = await import("./ai-gateway.server");
    const ai = createConfiguredAiModel({
      googleModel: "gemini-flash-latest",
      lovableModel: "google/gemini-3-flash-preview",
    });
    try {
      const { text } = await generateText({
        model: ai.model,
        prompt: "Responda em uma frase curta: você está online e qual modelo de IA está respondendo?",
        maxRetries: 2,
      });
      return { model: ai.modelId, ms: Date.now() - started, reply: text.trim() };
    } catch (error) {
      return { model: ai.modelId, ms: Date.now() - started, reply: getAiFallbackMessage(error, "testar a conexão") };
    }
  });

export const askCoach = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => CoachInput.parse(input))
  .handler(async ({ data, context }) => {
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

    const { createConfiguredAiModel, getAiFallbackMessage } = await import("./ai-gateway.server");
    const ai = createConfiguredAiModel({
      googleModel: "gemini-flash-latest",
      lovableModel: "google/gemini-3-flash-preview",
    });

    const system = `Você é um coach de musculação experiente, direto e motivador, respondendo em português brasileiro.
Baseie sugestões em ciência do treinamento: princípio da sobrecarga progressiva, ajuste de descanso conforme intensidade (hipertrofia 60-90s, força 2-4min, resistência 30-45s), split adequado à frequência semanal, e alerta para overtraining.
Se o usuário mencionar uso de recursos ergogênicos (esteroides / SARMs), aumente o volume e a frequência com responsabilidade e recomende acompanhamento médico.

VOCÊ TEM FERRAMENTAS para consultar o histórico REAL do usuário — use-as sempre que a pergunta envolver:
- sugerir treino/exercício para hoje → chame get_recovery_status e list_user_workouts
- sugerir carga ou progressão em um exercício → chame get_exercise_history com o nome do exercício
- ajustar descanso/volume → cheque get_sleep_summary e get_recent_sessions
- avaliar se deve treinar hoje → chame get_recovery_status
Chame as ferramentas necessárias ANTES de responder. Baseie a resposta em números REAIS do histórico, não invente.
Responda em no máximo 6 frases, use bullets quando fizer sentido, e cite números concretos (kg, reps, séries, min de descanso).`;

    const context_text = `Perfil do usuário:
- Nome: ${profile?.display_name ?? "-"}
- Sexo: ${profile?.sex ?? "-"} · Idade: ${age ?? "-"}${age != null ? " anos" : ""}
- Altura: ${profile?.height_cm ?? "-"}${profile?.height_cm ? " cm" : ""} · Peso: ${profile?.weight_kg ?? "-"}${profile?.weight_kg ? " kg" : ""}${bmi ? ` · IMC ${bmi}` : ""}
- Nível: ${profile?.experience_level ?? "iniciante"}
- Objetivo: ${profile?.goal ?? "hipertrofia"}
- Frequência semanal: ${profile?.weekly_frequency ?? "-"} dias
- Usa recursos ergogênicos: ${profile?.uses_enhancers ? "sim" : "não"}
- Lesões / limitações: ${profile?.injuries?.trim() || "nenhuma informada"}

Treinos cadastrados: ${workouts?.map((w: any) => `${w.label} (${w.name}) — ${w.workout_exercises?.length ?? 0} exercícios`).join("; ") || "nenhum"}
Últimas sessões: ${sessions?.map((s: any) => `${s.workouts?.label ?? "?"} em ${new Date(s.started_at).toLocaleDateString("pt-BR")} (esforço ${s.perceived_effort ?? "?"})`).join("; ") || "nenhuma"}

Pergunta do usuário: ${data.question}

Use as ferramentas disponíveis quando precisar de números específicos do histórico (progressão de carga, sono, recuperação, exercícios de um treino).`;

    const tools = {

      list_user_workouts: tool({
        description: "Lista os treinos cadastrados do usuário com quantidade de exercícios de cada um.",
        inputSchema: z.object({}),
        execute: async () => {
          const { data } = await supabase
            .from("workouts")
            .select("id, label, name, notes, workout_exercises(id)")
            .eq("user_id", userId)
            .order("order_idx", { ascending: true });
          return (data ?? []).map((w: any) => ({
            id: w.id, label: w.label, name: w.name, notes: w.notes,
            exercise_count: w.workout_exercises?.length ?? 0,
          }));
        },
      }),
      get_workout_details: tool({
        description: "Retorna os exercícios de um treino específico com séries, reps, carga alvo e descanso alvo.",
        inputSchema: z.object({ workout_id: z.string().uuid() }),
        execute: async ({ workout_id }) => {
          const { data } = await supabase
            .from("workout_exercises")
            .select("target_sets, target_reps, target_weight_kg, target_rest_seconds, notes, exercises(name, muscle_group)")
            .eq("workout_id", workout_id)
            .order("order_idx", { ascending: true });
          return data ?? [];
        },
      }),
      get_recent_sessions: tool({
        description: "Últimas sessões de treino do usuário (padrão 10) com esforço percebido e treino associado.",
        inputSchema: z.object({ limit: z.number().int().min(1).max(30).optional() }),
        execute: async ({ limit }) => {
          const { data } = await supabase
            .from("sessions")
            .select("started_at, ended_at, perceived_effort, notes, workouts(label, name)")
            .eq("user_id", userId)
            .order("started_at", { ascending: false })
            .limit(limit ?? 10);
          return data ?? [];
        },
      }),
      get_exercise_history: tool({
        description: "Histórico das últimas séries feitas em um exercício (por nome, case-insensitive). Retorna reps, carga (kg) e RPE por sessão — use para sugerir progressão de carga.",
        inputSchema: z.object({
          exercise_name: z.string().min(2),
          sessions: z.number().int().min(1).max(10).optional().describe("Quantas sessões trazer (padrão 5)."),
        }),
        execute: async ({ exercise_name, sessions: sessLimit }) => {
          const { data: ex } = await supabase
            .from("exercises").select("id, name, muscle_group")
            .ilike("name", `%${exercise_name}%`).limit(1).maybeSingle();
          if (!ex) return { found: false, message: `Exercício "${exercise_name}" não encontrado no catálogo.` };
          const { data } = await supabase
            .from("session_sets")
            .select("reps, weight_kg, rpe, completed_at, session_id, sessions!inner(user_id, started_at)")
            .eq("exercise_id", ex.id)
            .eq("sessions.user_id", userId)
            .order("completed_at", { ascending: false })
            .limit((sessLimit ?? 5) * 6);
          const bySession = new Map<string, any[]>();
          for (const s of data ?? []) {
            const arr = bySession.get(s.session_id) ?? [];
            arr.push({ reps: s.reps, weight_kg: s.weight_kg, rpe: s.rpe });
            bySession.set(s.session_id, arr);
          }
          const grouped = Array.from(bySession.entries()).slice(0, sessLimit ?? 5).map(([session_id, sets]) => {
            const date = (data ?? []).find((r: any) => r.session_id === session_id)?.sessions?.started_at;
            return { date, sets };
          });
          return { found: true, exercise: ex, sessions: grouped };
        },
      }),
      get_sleep_summary: tool({
        description: "Resumo do sono nos últimos N dias (padrão 7): média de horas, qualidade e última noite.",
        inputSchema: z.object({ days: z.number().int().min(1).max(30).optional() }),
        execute: async ({ days }) => {
          const d = days ?? 7;
          const since = new Date(Date.now() - d * 86400000).toISOString().slice(0, 10);
          const { data } = await supabase
            .from("sleep_logs").select("log_date, hours, quality")
            .eq("user_id", userId).gte("log_date", since)
            .order("log_date", { ascending: false });
          const arr = data ?? [];
          if (!arr.length) return { has_data: false };
          const avg = arr.reduce((a, s: any) => a + Number(s.hours), 0) / arr.length;
          const qArr = arr.filter((s: any) => s.quality != null);
          const qAvg = qArr.length ? qArr.reduce((a, s: any) => a + Number(s.quality), 0) / qArr.length : null;
          return { has_data: true, nights: arr.length, avg_hours: Number(avg.toFixed(1)), avg_quality: qAvg, last_night: arr[0], logs: arr };
        },
      }),
      get_recovery_status: tool({
        description: "Análise consolidada de recuperação do usuário (status, motivo, recomendação) — considera sessões, sono, ciclo menstrual se aplicável.",
        inputSchema: z.object({}),
        execute: async () => {
          // Import the shared helper directly. Calling `getRecoveryAdvice` (a
          // server fn stub) from inside another server-fn handler routes
          // through the RPC boundary and fails in production with
          // "Server function info not found for <hash>".
          const { computeRecoveryAdviceFor } = await import("./recovery.server");
          try {
            return await computeRecoveryAdviceFor(supabase, userId);
          } catch (error) {
            console.error("[coach:get_recovery_status] failed:", error);
            return { error: "Recuperação indisponível no momento." };
          }
        },
      }),
    };

    try {
      const { text } = await generateText({
        model: ai.model,
        system,
        prompt: context_text,
        tools,
        stopWhen: stepCountIs(8),
        maxRetries: 2,
      });

      return { answer: text };
    } catch (error) {
      return { answer: getAiFallbackMessage(error, "responder o coach") };
    }
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


    const { createConfiguredAiModel, getAiFallbackMessage } = await import("./ai-gateway.server");
    const ai = createConfiguredAiModel({
      googleModel: "gemini-flash-latest",
      lovableModel: "google/gemini-3-flash-preview",
    });

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

    const buildLocalPlan = (reason: string): z.infer<typeof PlanSchema> => {
      const labels = ["A", "B", "C", "D", "E", "F", "G"];
      const byGroup = new Map<string, typeof exercisesLib>();
      for (const exercise of exercisesLib ?? []) {
        const group = String(exercise.muscle_group || "Outros").toLowerCase();
        byGroup.set(group, [...(byGroup.get(group) ?? []), exercise]);
      }

      const pick = (groups: string[], limit = 6) => {
        const chosen: { name: string; muscle_group: string; sets: number; reps: string; rest_seconds: number }[] = [];
        const seen = new Set<string>();
        for (const groupName of groups) {
          const matches = [...(byGroup.get(groupName.toLowerCase()) ?? [])];
          if (!matches.length) {
            matches.push(
              ...((exercisesLib ?? []).filter((exercise) =>
                String(exercise.muscle_group || "").toLowerCase().includes(groupName.toLowerCase()),
              )),
            );
          }
          for (const exercise of matches) {
            if (chosen.length >= limit) break;
            if (seen.has(exercise.name)) continue;
            seen.add(exercise.name);
            chosen.push({
              name: exercise.name,
              muscle_group: exercise.muscle_group || "Outros",
              sets: data.uses_enhancers ? 5 : data.experience === "iniciante" ? 3 : 4,
              reps: /força/i.test(data.goal) ? "4-6" : /resist/i.test(data.goal) || /emagrec/i.test(data.goal) ? "12-15" : "8-12",
              rest_seconds: /força/i.test(data.goal) ? 180 : /resist/i.test(data.goal) || /emagrec/i.test(data.goal) ? 45 : 90,
            });
          }
        }

        if (!chosen.length) {
          for (const exercise of exercisesLib ?? []) {
            if (chosen.length >= Math.min(limit, 5)) break;
            if (seen.has(exercise.name)) continue;
            seen.add(exercise.name);
            chosen.push({
              name: exercise.name,
              muscle_group: exercise.muscle_group || "Outros",
              sets: 3,
              reps: "10-12",
              rest_seconds: 90,
            });
          }
        }
        return chosen;
      };

      const templatesByDays: Record<number, { name: string; groups: string[] }[]> = {
        1: [{ name: "Full body", groups: ["Peito", "Costas", "Pernas", "Ombros", "Bíceps", "Tríceps"] }],
        2: [
          { name: "Full body A", groups: ["Peito", "Costas", "Pernas", "Ombros"] },
          { name: "Full body B", groups: ["Pernas", "Costas", "Peito", "Bíceps", "Tríceps"] },
        ],
        3: [
          { name: "Push", groups: ["Peito", "Ombros", "Tríceps"] },
          { name: "Pull", groups: ["Costas", "Bíceps"] },
          { name: "Legs", groups: ["Pernas", "Glúteos", "Panturrilhas"] },
        ],
        4: [
          { name: "Upper A", groups: ["Peito", "Costas", "Ombros", "Bíceps", "Tríceps"] },
          { name: "Lower A", groups: ["Pernas", "Glúteos", "Panturrilhas"] },
          { name: "Upper B", groups: ["Costas", "Peito", "Ombros", "Tríceps", "Bíceps"] },
          { name: "Lower B", groups: ["Pernas", "Glúteos", "Abdômen"] },
        ],
        5: [
          { name: "Peito e tríceps", groups: ["Peito", "Tríceps"] },
          { name: "Costas e bíceps", groups: ["Costas", "Bíceps"] },
          { name: "Pernas", groups: ["Pernas", "Glúteos", "Panturrilhas"] },
          { name: "Ombros e core", groups: ["Ombros", "Abdômen"] },
          { name: "Full body leve", groups: ["Peito", "Costas", "Pernas"] },
        ],
        6: [
          { name: "Push A", groups: ["Peito", "Ombros", "Tríceps"] },
          { name: "Pull A", groups: ["Costas", "Bíceps"] },
          { name: "Legs A", groups: ["Pernas", "Glúteos", "Panturrilhas"] },
          { name: "Push B", groups: ["Peito", "Ombros", "Tríceps"] },
          { name: "Pull B", groups: ["Costas", "Bíceps"] },
          { name: "Legs B", groups: ["Pernas", "Glúteos", "Panturrilhas"] },
        ],
      };

      const baseTemplates = templatesByDays[data.days_per_week] ?? [
        ...(templatesByDays[6] ?? []),
        { name: "Mobilidade e core", groups: ["Abdômen", "Mobilidade", "Pernas"] },
      ];

      return {
        overview: `${reason} Criei um plano seguro em modo manual/fallback para você revisar e ajustar antes de enviar.`,
        splits: baseTemplates.slice(0, data.days_per_week).map((template, index) => ({
          label: labels[index] ?? String(index + 1),
          name: template.name,
          notes: `Plano base para ${data.goal.toLowerCase()}, nível ${data.experience}, com descanso e volume conservadores.`,
          exercises: pick(template.groups, data.experience === "iniciante" ? 5 : 6),
        })),
      };
    };

    // Nonce força variação entre gerações com os mesmos parâmetros
    const variationNonce = Math.random().toString(36).slice(2, 8);
    const variationHint = `\n\nIMPORTANTE: cada geração deve ser DIFERENTE da anterior. Varie a escolha de exercícios dentro da biblioteca (não repita sempre os "óbvios"), a ordem, e as notas. Combine variações de barra, halter, máquina e cabo. Semente de variação: ${variationNonce}.`;

    let plan: z.infer<typeof PlanSchema>;
    let usedFallback = false;
    let fallbackReason = "";
    try {
      const { output } = await generateText({
        model: ai.model,
        system,
        prompt: prompt + variationHint,
        output: Output.object({ schema: PlanSchema }),
        temperature: 0.9,
        topP: 0.95,
        maxRetries: 2,
      });
      plan = output;
    } catch (error: any) {
      if (NoObjectGeneratedError.isInstance(error) && error.text) {
        const match = error.text.match(/\{[\s\S]*\}/);
        if (match) {
          try {
            plan = PlanSchema.parse(JSON.parse(match[0]));
          } catch {
            usedFallback = true;
            fallbackReason = "A IA não devolveu um plano válido.";
            plan = buildLocalPlan(fallbackReason);
          }
        } else {
          usedFallback = true;
          fallbackReason = "A IA não devolveu um plano válido.";
          plan = buildLocalPlan(fallbackReason);
        }
      } else {
        usedFallback = true;
        fallbackReason = getAiFallbackMessage(error, "gerar o plano");
        plan = buildLocalPlan(fallbackReason);
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

    return { overview: plan.overview, workouts: created, usedFallback, fallbackReason };
  });

