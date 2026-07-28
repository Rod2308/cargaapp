import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Devolve a chave pública VAPID para o cliente inscrever o navegador.
export const getVapidPublicKey = createServerFn({ method: "GET" }).handler(async () => {
  const { getVapidPublicKeyAction } = await import("./bridge-actions.server");
  return getVapidPublicKeyAction();
});

export const savePushSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => input)
  .handler(async ({ data, context }) => {
    const { savePushSubscriptionAction } = await import("./bridge-actions.server");
    return savePushSubscriptionAction(context.supabase, context.userId, data);
  });

export const deletePushSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => input)
  .handler(async ({ data, context }) => {
    const { deletePushSubscriptionAction } = await import("./bridge-actions.server");
    return deletePushSubscriptionAction(context.supabase, context.userId, data);
  });
