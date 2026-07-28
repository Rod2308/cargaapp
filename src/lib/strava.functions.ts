import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// ------ Read connection status for current user ------
export const getStravaStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { getStravaStatusAction } = await import("./bridge-actions.server");
    return getStravaStatusAction(context.supabase, context.userId);
  });

// ------ Build authorize URL for OAuth ------
export const getStravaAuthorizeUrl = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { getStravaAuthorizeUrlAction } = await import("./bridge-actions.server");
    return getStravaAuthorizeUrlAction(context.supabase, context.userId);
  });

// ------ Disconnect ------
export const disconnectStrava = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { disconnectStravaAction } = await import("./bridge-actions.server");
    return disconnectStravaAction(context.supabase, context.userId);
  });

// ------ Backfill recent activities ------
export const backfillStrava = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => input)
  .handler(async ({ context, data }) => {
    const { backfillStravaAction } = await import("./bridge-actions.server");
    return backfillStravaAction(context.supabase, context.userId, data);
  });

// ------ Sync latest activity or today's activities ------
export const syncStravaLatest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => input)
  .handler(async ({ context, data }) => {
    const { syncStravaLatestAction } = await import("./bridge-actions.server");
    return syncStravaLatestAction(context.supabase, context.userId, data);
  });

// ------ Ensure a global webhook subscription exists (one per app) ------
export const ensureStravaWebhook = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { ensureStravaWebhookAction } = await import("./bridge-actions.server");
    return ensureStravaWebhookAction();
  });
