import { generateText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { bridged } from "./server-bridge";

export type AiProvider = "openai" | "anthropic" | "google";

/**
 * Roteia chamadas de IA priorizando a chave do usuário se disponível.
 */
export async function routeAiRequest(userId: string, options: {
  systemPrompt: string;
  userPrompt: string;
  jsonMode?: boolean;
}) {
  // 1. Busca config do usuário via bridge (seguro, server-side)
  const config = await bridged("ai.getConfig", async (supabase, uid) => {
    const { data } = await supabase
      .from("user_ai_configs" as any)
      .select("provider, api_key")
      .eq("user_id", uid)
      .maybeSingle();
    return data;
  })(userId);

  let model;
  if (config?.api_key && config?.provider) {
    // Usa chave do usuário
    const provider = config.provider as AiProvider;
    if (provider === "openai") {
      model = createOpenAI({ apiKey: config.api_key })("gpt-4o");
    } else if (provider === "anthropic") {
      model = createAnthropic({ apiKey: config.api_key })("claude-3-5-sonnet-20240620");
    } else if (provider === "google") {
      model = createGoogleGenerativeAI({ apiKey: config.api_key })("gemini-1.5-pro");
    }
  }

  // Fallback para chave padrão (via Lovable AI Gateway implicitamente se model for nulo)
  if (!model) {
    // Aqui usamos o provedor padrão configurado no ambiente se o usuário não tiver chave
    const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY });
    model = openai("gpt-4o");
  }

  const { text } = await generateText({
    model,
    system: options.systemPrompt,
    prompt: options.userPrompt,
  });

  if (options.jsonMode) {
    try {
      // Tenta extrair JSON do texto (alguns modelos podem colocar markdown)
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      return JSON.parse(jsonMatch ? jsonMatch[0] : text);
    } catch (e) {
      console.error("AI JSON Parse Error:", e, "Raw text:", text);
      throw new Error("A IA retornou um formato inválido. Tente novamente.");
    }
  }

  return text;
}
