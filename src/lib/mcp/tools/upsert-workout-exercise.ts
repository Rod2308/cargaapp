import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser, unauthorized } from "./_supabase";

export default defineTool({
  name: "upsert_workout_exercise",
  title: "Registrar ou atualizar exercício em um treino",
  description:
    "Adiciona um novo exercício ao treino ou atualiza um existente (séries, reps, carga alvo, descanso, ordem, notas). Passe workout_exercise_id para atualizar; omita para criar novo. exercise_id é obrigatório na criação.",
  inputSchema: {
    workout_id: z.string().uuid().describe("ID do treino (obtido via list_workouts)."),
    workout_exercise_id: z
      .string()
      .uuid()
      .optional()
      .describe("ID do registro em workout_exercises. Se informado, atualiza; senão, cria novo."),
    exercise_id: z
      .string()
      .uuid()
      .optional()
      .describe("ID do exercício (do catálogo). Obrigatório ao criar."),
    order_idx: z.number().int().min(0).optional().describe("Ordem do exercício no treino."),
    target_sets: z.number().int().min(1).max(20).optional(),
    target_reps: z.number().int().min(1).max(100).optional(),
    target_weight_kg: z.number().min(0).max(1000).optional(),
    target_rest_seconds: z.number().int().min(0).max(1800).optional(),
    notes: z.string().max(500).optional(),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  handler: async (input, ctx) => {
    if (!ctx.isAuthenticated()) return unauthorized();
    const supabase = supabaseForUser(ctx);

    // Garante que o treino pertence a alguém que o usuário pode alterar (RLS decide).
    const { data: workout, error: wErr } = await supabase
      .from("workouts")
      .select("id")
      .eq("id", input.workout_id)
      .maybeSingle();
    if (wErr) return { content: [{ type: "text", text: wErr.message }], isError: true };
    if (!workout) {
      return { content: [{ type: "text", text: "Treino não encontrado ou sem permissão." }], isError: true };
    }

    const fields = {
      order_idx: input.order_idx,
      target_sets: input.target_sets,
      target_reps: input.target_reps,
      target_weight_kg: input.target_weight_kg,
      target_rest_seconds: input.target_rest_seconds,
      notes: input.notes,
    };

    if (input.workout_exercise_id) {
      // UPDATE
      const patch: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(fields)) if (v !== undefined) patch[k] = v;
      if (input.exercise_id) patch.exercise_id = input.exercise_id;
      if (Object.keys(patch).length === 0) {
        return { content: [{ type: "text", text: "Nada para atualizar." }], isError: true };
      }
      const { data, error } = await supabase
        .from("workout_exercises")
        .update(patch)
        .eq("id", input.workout_exercise_id)
        .eq("workout_id", input.workout_id)
        .select("id, workout_id, exercise_id, order_idx, target_sets, target_reps, target_weight_kg, target_rest_seconds, notes")
        .maybeSingle();
      if (error) return { content: [{ type: "text", text: error.message }], isError: true };
      if (!data) return { content: [{ type: "text", text: "Exercício do treino não encontrado." }], isError: true };
      return {
        content: [{ type: "text", text: `Exercício atualizado (${data.id}).` }],
        structuredContent: { action: "updated", workout_exercise: data },
      };
    }

    // INSERT
    if (!input.exercise_id) {
      return { content: [{ type: "text", text: "exercise_id é obrigatório para criar um novo exercício no treino." }], isError: true };
    }

    // Se order_idx não foi passado, coloca no final.
    let orderIdx = input.order_idx;
    if (orderIdx === undefined) {
      const { data: last } = await supabase
        .from("workout_exercises")
        .select("order_idx")
        .eq("workout_id", input.workout_id)
        .order("order_idx", { ascending: false })
        .limit(1)
        .maybeSingle();
      orderIdx = (last?.order_idx ?? -1) + 1;
    }

    const insertRow: Record<string, unknown> = {
      workout_id: input.workout_id,
      exercise_id: input.exercise_id,
      order_idx: orderIdx,
    };
    for (const [k, v] of Object.entries(fields)) {
      if (k === "order_idx") continue;
      if (v !== undefined) insertRow[k] = v;
    }

    const { data, error } = await supabase
      .from("workout_exercises")
      .insert(insertRow)
      .select("id, workout_id, exercise_id, order_idx, target_sets, target_reps, target_weight_kg, target_rest_seconds, notes")
      .maybeSingle();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: `Exercício adicionado ao treino (${data?.id}).` }],
      structuredContent: { action: "created", workout_exercise: data },
    };
  },
});
