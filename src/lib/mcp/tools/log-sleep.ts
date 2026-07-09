import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser, unauthorized } from "./_supabase";

export default defineTool({
  name: "log_sleep",
  title: "Registrar sono",
  description: "Registra (ou atualiza) as horas e qualidade do sono do usuário para uma data. Se log_date for omitido, usa hoje.",
  inputSchema: {
    hours: z.number().min(0).max(24).describe("Horas dormidas (0-24)."),
    quality: z.number().int().min(1).max(5).optional().describe("Qualidade do sono (1-5)."),
    log_date: z.string().optional().describe("Data no formato YYYY-MM-DD. Padrão: hoje."),
    notes: z.string().optional().describe("Observações opcionais."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  handler: async ({ hours, quality, log_date, notes }, ctx) => {
    if (!ctx.isAuthenticated()) return unauthorized();
    const supabase = supabaseForUser(ctx);
    const date = log_date ?? new Date().toISOString().slice(0, 10);
    const { data, error } = await supabase
      .from("sleep_logs")
      .upsert(
        { user_id: ctx.getUserId(), log_date: date, hours, quality: quality ?? null, notes: notes ?? null },
        { onConflict: "user_id,log_date" },
      )
      .select()
      .maybeSingle();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: `Sono registrado: ${date} — ${hours}h${quality ? ` · qualidade ${quality}/5` : ""}` }],
      structuredContent: { entry: data },
    };
  },
});
