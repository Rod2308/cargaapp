// Server-only: provider de IA.
// Usa a API do Google Generative Language diretamente (endpoint OpenAI-compat)
// quando GOOGLE_API_KEY estiver configurada; senão cai no Lovable AI Gateway.
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

export function createLovableAiGatewayProvider(_ignored?: string) {
  const googleKey = process.env.GOOGLE_API_KEY;
  if (googleKey) {
    return createOpenAICompatible({
      name: "google",
      baseURL: "https://generativelanguage.googleapis.com/v1beta/openai",
      headers: {
        Authorization: `Bearer ${googleKey}`,
      },
    });
  }

  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) throw new Error("IA indisponível: nenhuma chave configurada.");

  return createOpenAICompatible({
    name: "lovable",
    baseURL: "https://ai.gateway.lovable.dev/v1",
    headers: {
      "Lovable-API-Key": apiKey,
    },
  });
}
