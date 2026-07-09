import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser, unauthorized } from "./_supabase";

export default defineTool({
  name: "list_recent_sessions",
  title: "Sessões recentes de treino",
  description: "Lista as sessões de treino concluídas mais recentes do usuário, com esforço percebido, duração e treino associado.",
  inputSchema: {
    days: z.number().int().min(1).max(90).optional().describe("Janela em dias (padrão 14)."),
    limit: z.number().int().min(1).max(50).optional().describe("Máximo de sessões (padrão 20)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ days, limit }, ctx) => {
    if (!ctx.isAuthenticated()) return unauthorized();
    const supabase = supabaseForUser(ctx);
    const since = new Date(Date.now() - (days ?? 14) * 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await supabase
      .from("sessions")
      .select("id, started_at, ended_at, perceived_effort, notes, workouts(label, name)")
      .gte("started_at", since)
      .order("started_at", { ascending: false })
      .limit(limit ?? 20);
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      structuredContent: { sessions: data ?? [] },
    };
  },
});
