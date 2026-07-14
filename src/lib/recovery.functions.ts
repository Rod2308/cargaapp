import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { computeRecoveryAdviceFor, type RecoveryAdvice } from "./recovery.server";

export type { RecoveryAdvice };

/**
 * Server function wrapper. All computation lives in recovery.server.ts so
 * other server-fn handlers (e.g. the coach) can import the helper directly
 * without going through the RPC stub.
 */
export const getRecoveryAdvice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<RecoveryAdvice> => {
    try {
      return await computeRecoveryAdviceFor(context.supabase, context.userId);
    } catch (error) {
      console.error("[getRecoveryAdvice] failed:", error instanceof Error ? error.message : error);
      throw new Error("Não foi possível calcular sua recuperação agora. Tente novamente em alguns instantes.");
    }
  });
