import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { RecoveryAdvice } from "./recovery-core";

export type { RecoveryAdvice };

/**
 * Wrapper de server function. Toda a lógica vive em bridge-actions.server.ts,
 * compartilhada com a rota-ponte usada pelo domínio espelho.
 */
export const getRecoveryAdvice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<RecoveryAdvice> => {
    const { getRecoveryAdviceAction } = await import("./bridge-actions.server");
    return getRecoveryAdviceAction(context.supabase, context.userId);
  });
