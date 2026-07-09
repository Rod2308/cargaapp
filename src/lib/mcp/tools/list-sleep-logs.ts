import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser, unauthorized } from "./_supabase";

export default defineTool({
  name: "list_sleep_logs",
  title: "Histórico de sono",
  description: "Lista os registros de sono do usuário nos últimos N dias (padrão 14), do mais recente para o mais antigo.",
  inputSchema: {
    days: z.number().int().min(1).max(180).optional().describe("Janela em dias (padrão 14)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ days }, ctx) => {
    if (!ctx.isAuthenticated()) return unauthorized();
    const supabase = supabaseForUser(ctx);
    const since = new Date(Date.now() - (days ?? 14) * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const { data, error } = await supabase
      .from("sleep_logs")
      .select("log_date, hours, quality, notes")
      .gte("log_date", since)
      .order("log_date", { ascending: false });
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      structuredContent: { logs: data ?? [] },
    };
  },
});
