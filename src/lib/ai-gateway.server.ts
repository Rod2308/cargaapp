// Server-only: provider do Google Gemini usando a chave do usuário (GEMINI_API_KEY).
import { createGoogleGenerativeAI } from "@ai-sdk/google";

export function createLovableAiGatewayProvider(_ignored?: string) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY ausente. Configure a chave da API do Google Gemini.");
  return createGoogleGenerativeAI({ apiKey });
}
