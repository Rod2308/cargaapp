// Fallback 100% cliente para Web Push, usado quando as server functions não
// existem (app servido como site estático no domínio espelho).
// A chave pública VAPID é buscada na origem canônica (rota pública com CORS)
// e as assinaturas vão direto para a tabela push_subscriptions via RLS.

import { supabase } from "@/integrations/supabase/client";
import { CANONICAL_ORIGIN } from "@/lib/auth-bridge";

export async function fetchVapidPublicKeyClient(): Promise<string> {
  const urls = [`${window.location.origin}/api/public/vapid`, `${CANONICAL_ORIGIN}/api/public/vapid`];
  let lastError: unknown = null;
  for (const url of urls) {
    try {
      const res = await fetch(url, { headers: { accept: "application/json" } });
      if (!res.ok) continue;
      const json = (await res.json()) as { publicKey?: string };
      if (json?.publicKey) return json.publicKey;
    } catch (err) {
      lastError = err;
    }
  }
  throw new Error(
    lastError instanceof Error
      ? `Não foi possível obter a chave de notificações: ${lastError.message}`
      : "Não foi possível obter a chave de notificações.",
  );
}

export async function savePushSubscriptionClient(input: {
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent?: string;
}) {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) throw new Error("Sessão expirada. Entre novamente.");

  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      user_id: userId,
      endpoint: input.endpoint,
      p256dh: input.p256dh,
      auth: input.auth,
      user_agent: input.userAgent ?? null,
      last_seen_at: new Date().toISOString(),
    },
    { onConflict: "user_id,endpoint" },
  );
  if (error) throw new Error(error.message);
  return { ok: true };
}

export async function deletePushSubscriptionClient(endpoint: string) {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) return { ok: false };

  const { error } = await supabase
    .from("push_subscriptions")
    .delete()
    .eq("user_id", userId)
    .eq("endpoint", endpoint);
  if (error) throw new Error(error.message);
  return { ok: true };
}
