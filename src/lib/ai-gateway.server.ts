// Server-only: provider de IA.
// Ordem de preferência: OpenAI -> Google direto -> Lovable AI Gateway.
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

export function createConfiguredAiModel({
  googleModel = "gemini-flash-latest",
  lovableModel = "google/gemini-3-flash-preview",
  openaiModel = "gpt-4o-mini",
  anthropicModel = "claude-3-5-haiku-latest",
}: {
  googleModel?: string;
  lovableModel?: string;
  openaiModel?: string;
  anthropicModel?: string;
} = {}) {
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (anthropicKey) {
    const anthropic = createAnthropic({ apiKey: anthropicKey });
    return { model: anthropic(anthropicModel), modelId: anthropicModel, provider: "anthropic" as const };
  }

  const openaiKey = process.env.OPENAI_API_KEY;
  if (openaiKey) {
    const openai = createOpenAI({ apiKey: openaiKey });
    return { model: openai(openaiModel), modelId: openaiModel, provider: "openai" as const };
  }


  const googleKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
  if (googleKey) {
    const google = createGoogleGenerativeAI({ apiKey: googleKey });
    return { model: google(googleModel), modelId: googleModel, provider: "google" as const };
  }

  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) throw new Error("IA indisponível: nenhuma chave configurada.");

  const gateway = createOpenAICompatible({
    name: "lovable",
    baseURL: "https://ai.gateway.lovable.dev/v1",
    headers: {
      "Lovable-API-Key": apiKey,
      "X-Lovable-AIG-SDK": "vercel-ai-sdk",
    },
  });

  return { model: gateway(lovableModel), modelId: lovableModel, provider: "lovable" as const };
}

export function createLovableAiGatewayProvider(_ignored?: string) {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) throw new Error("IA indisponível: nenhuma chave configurada.");

  return createOpenAICompatible({
    name: "lovable",
    baseURL: "https://ai.gateway.lovable.dev/v1",
    headers: {
      "Lovable-API-Key": apiKey,
      "X-Lovable-AIG-SDK": "vercel-ai-sdk",
    },
  });
}

export function getAiErrorStatus(error: unknown) {
  const err = error as any;
  return err?.statusCode ?? err?.status ?? err?.response?.status;
}

export function getAiFallbackMessage(error: unknown, action = "gerar a resposta") {
  const status = getAiErrorStatus(error);
  const msg = String((error as any)?.message ?? "");

  if (status === 402 || /payment required|credit|insufficient/i.test(msg)) {
    return "Os créditos de IA acabaram. Use o modo manual por enquanto.";
  }

  if (status === 429 || /quota|rate limit|too many requests/i.test(msg)) {
    return "A IA atingiu o limite de uso agora. Use o modo manual ou tente novamente em alguns minutos.";
  }

  if ([500, 502, 503, 504].includes(Number(status)) || /service unavailable|high demand|temporar/i.test(msg)) {
    return `A IA está temporariamente indisponível para ${action}. Use o modo manual ou tente novamente em alguns minutos.`;
  }

  return `Não foi possível ${action} com IA agora. Use o modo manual ou tente novamente.`;
}
