import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { bridged } from "./server-bridge";

const AiConfigInput = z.object({
  provider: z.enum(["openai", "anthropic", "google"]),
  api_key: z.string().min(1),
});

export const saveUserAiConfig = createServerFn({ method: "POST" })
  .validator((data: unknown) => AiConfigInput.parse(data))
  .handler(async ({ data }) => {
    return (bridged("ai.saveConfig", async () => ({} as any)) as any)(data);
  });

export const getUserAiConfig = createServerFn({ method: "GET" })
  .handler(async () => {
    return (bridged("ai.getConfig", async () => ({} as any)) as any)({});
  });

export const deleteUserAiConfig = createServerFn({ method: "POST" })
  .handler(async () => {
    return (bridged("ai.deleteConfig", async () => ({} as any)) as any)({});
  });

export const validateAiKey = createServerFn({ method: "POST" })
  .validator((data: unknown) => AiConfigInput.parse(data))
  .handler(async ({ data }) => {
    const { provider, api_key } = data;
    
    try {
      if (provider === "openai") {
        const res = await fetch("https://api.openai.com/v1/models", {
          headers: { Authorization: `Bearer ${api_key}` },
        });
        return { valid: res.ok };
      }
      
      if (provider === "anthropic") {
        const res = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "x-api-key": api_key,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
          },
          body: JSON.stringify({
            model: "claude-3-haiku-20240307",
            max_tokens: 1,
            messages: [{ role: "user", content: "hi" }],
          }),
        });
        return { valid: res.status !== 401 && res.status !== 403 };
      }
      
      if (provider === "google") {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${api_key}`);
        return { valid: res.ok };
      }
      
      return { valid: false, error: "Provedor desconhecido" };
    } catch (e) {
      return { valid: false, error: e instanceof Error ? e.message : "Erro na validação" };
    }
  });
