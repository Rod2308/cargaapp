import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser, unauthorized } from "./_supabase";

export default defineTool({
  name: "get_workout",
  title: "Detalhes de um treino",
  description: "Retorna os exercícios de um treino específico (séries, reps, carga alvo, descanso).",
  inputSchema: {
    workout_id: z.string().uuid().describe("ID do treino (obtido via list_workouts)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ workout_id }, ctx) => {
    if (!ctx.isAuthenticated()) return unauthorized();
    const supabase = supabaseForUser(ctx);
    const [{ data: workout, error: wErr }, { data: exercises, error: eErr }] = await Promise.all([
      supabase.from("workouts").select("id, label, name, notes").eq("id", workout_id).maybeSingle(),
      supabase
        .from("workout_exercises")
        .select("id, order_idx, target_sets, target_reps, target_weight_kg, target_rest_seconds, notes, exercises(name, muscle_group)")
        .eq("workout_id", workout_id)
        .order("order_idx", { ascending: true }),
    ]);
    const err = wErr ?? eErr;
    if (err) return { content: [{ type: "text", text: err.message }], isError: true };
    const payload = { workout, exercises: exercises ?? [] };
    return {
      content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
      structuredContent: payload,
    };
  },
});
