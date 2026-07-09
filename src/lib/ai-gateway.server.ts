// Server-only: provider de IA.
// Usa a API nativa do Google quando GOOGLE_API_KEY/GEMINI_API_KEY estiver
// configurada; senão cai no Lovable AI Gateway.
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

export function createConfiguredAiModel({
  googleModel = "gemini-flash-latest",
  lovableModel = "google/gemini-3-flash-preview",
}: {
  googleModel?: string;
  lovableModel?: string;
} = {}) {
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
