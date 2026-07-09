import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser, unauthorized } from "./_supabase";

export default defineTool({
  name: "list_workouts",
  title: "Listar treinos",
  description: "Lista os treinos (workouts) do usuário autenticado, com rótulo, nome e observações.",
  inputSchema: {
    limit: z.number().int().min(1).max(100).optional().describe("Máximo de treinos a retornar (padrão 50)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit }, ctx) => {
    if (!ctx.isAuthenticated()) return unauthorized();
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("workouts")
      .select("id, label, name, notes, order_idx, updated_at")
      .order("order_idx", { ascending: true })
      .limit(limit ?? 50);
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      structuredContent: { workouts: data ?? [] },
    };
  },
});
