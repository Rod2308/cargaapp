import { generateText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";

export type AiProvider = "openai" | "anthropic" | "google";

/**
 * Roteia chamadas de IA priorizando a chave do usuário se disponível.
 */
export async function routeAiRequest(userId: string, options: {
  systemPrompt: string;
  userPrompt: string;
  jsonMode?: boolean;
}) {
  // 1. Busca config do usuário
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: config, error } = await supabaseAdmin
    .from("user_ai_configs" as any)
    .select("provider, api_key")
    .eq("user_id", userId)
    .maybeSingle() as any;

  if (error) {
    console.error("[routeAiRequest] Error fetching config:", error);
  }

  try {
    let model;
    if (config?.api_key && config?.provider) {
      // Usa chave do usuário
      const provider = config.provider as AiProvider;
      if (provider === "openai") {
        model = createOpenAI({ apiKey: config.api_key })("gpt-4o");
      } else if (provider === "anthropic") {
        model = createAnthropic({ apiKey: config.api_key })("claude-3-5-sonnet-20240620");
      } else if (provider === "google") {
        model = createGoogleGenerativeAI({ apiKey: config.api_key })("gemini-1.5-pro-latest");
      }
    }

    // Fallback para chave padrão (via Lovable AI Gateway implicitamente se model for nulo)
    if (!model) {
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) throw new Error("Recurso de IA temporariamente indisponível. Por favor, adicione sua própria chave de API no Perfil.");
      const openai = createOpenAI({ apiKey });
      model = openai("gpt-4o");
    }

    const { text } = await generateText({
      model,
      system: options.systemPrompt,
      prompt: options.userPrompt,
    });

    if (options.jsonMode) {
      try {
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        return JSON.parse(jsonMatch ? jsonMatch[0] : text);
      } catch (e) {
        console.error("AI JSON Parse Error:", e, "Raw text:", text);
        throw new Error("A IA retornou um formato inválido. Tente novamente.");
      }
    }

    return text;
  } catch (err: any) {
    console.error("[routeAiRequest] Generation error:", err);
    if (err.status === 401 || err.message?.includes("401") || err.message?.includes("key")) {
      throw new Error("Sua chave de API de IA parece ser inválida ou expirou. Por favor, verifique-a no seu Perfil.");
    }
    throw new Error(err.message || "Erro inesperado na geração por IA.");
  }
}
