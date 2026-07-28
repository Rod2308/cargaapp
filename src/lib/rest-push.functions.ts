import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const scheduleRestPush = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => input)
  .handler(async ({ data, context }) => {
    const { scheduleRestPushAction } = await import("./bridge-actions.server");
    return scheduleRestPushAction(context.supabase, context.userId, data);
  });

export const cancelRestPush = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { cancelRestPushAction } = await import("./bridge-actions.server");
    return cancelRestPushAction(context.supabase, context.userId);
  });
