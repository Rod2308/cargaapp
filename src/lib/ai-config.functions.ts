import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { bridged } from "./server-bridge";

const AiConfigInput = z.object({
  provider: z.enum(["openai", "anthropic", "google"]),
  api_key: z.string().min(1),
});

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const saveUserAiConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => AiConfigInput.parse(data))
  .handler(async ({ data, context }) => {
    const { saveAiConfigAction } = await import("./bridge-actions.server");
    return saveAiConfigAction(context.supabase, context.userId, data);
  });

export const getUserAiConfig = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { getAiConfigAction } = await import("./bridge-actions.server");
    return getAiConfigAction(context.supabase, context.userId);
  });

export const deleteUserAiConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { deleteAiConfigAction } = await import("./bridge-actions.server");
    return deleteAiConfigAction(context.supabase, context.userId);
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
        if (!res.ok) {
          const body = await res.text();
          return { valid: false, error: `Erro Google: ${res.status} - ${body}` };
        }
        return { valid: true };
      }
      
      return { valid: false, error: "Provedor desconhecido" };
    } catch (e) {
      return { valid: false, error: e instanceof Error ? e.message : "Erro na validação" };
    }
  });
