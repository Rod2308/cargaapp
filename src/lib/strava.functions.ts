import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

// ------ Read connection status for current user ------
export const getStravaStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("strava_connections")
      .select("strava_athlete_id, last_sync_at, scope, created_at")
      .eq("user_id", context.userId)
      .maybeSingle();
    return {
      connected: !!data,
      athleteId: (data?.strava_athlete_id as number | undefined) ?? null,
      lastSyncAt: (data?.last_sync_at as string | null | undefined) ?? null,
      scope: (data?.scope as string | null | undefined) ?? null,
    };
  });

// ------ Build authorize URL for OAuth ------
export const getStravaAuthorizeUrl = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const clientId = process.env.STRAVA_CLIENT_ID;
    if (!clientId) throw new Error("STRAVA_CLIENT_ID is not configured");
    const { signState, STRAVA_OAUTH_AUTHORIZE, STRAVA_SCOPE } = await import("@/lib/strava.server");
    const origin =
      process.env.PUBLIC_APP_URL ||
      process.env.APP_URL ||
      "https://cargaapp.lovable.app";
    const redirectUri = `${origin.replace(/\/$/, "")}/api/public/strava/callback`;
    const params = new URLSearchParams({
      client_id: clientId,
      response_type: "code",
      redirect_uri: redirectUri,
      approval_prompt: "auto",
      scope: STRAVA_SCOPE,
      state: signState(context.userId),
    });
    return { url: `${STRAVA_OAUTH_AUTHORIZE}?${params.toString()}` };
  });

// ------ Disconnect ------
export const disconnectStrava = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Try to deauthorize on Strava's side (best-effort).
    const { getValidAccessTokenForUser } = await import("@/lib/strava.server");
    try {
      const token = await getValidAccessTokenForUser(context.userId);
      if (token) {
        await fetch("https://www.strava.com/oauth/deauthorize", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        });
      }
    } catch {
      // ignore
    }
    await supabaseAdmin.from("strava_connections").delete().eq("user_id", context.userId);
    return { ok: true };
  });

// ------ Backfill recent activities ------
export const backfillStrava = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ count: z.number().int().min(1).max(100).default(30) }).parse(input))
  .handler(async ({ context, data }) => {
    const { getValidAccessTokenForUser, listRecentActivities, upsertActivityForUser } = await import("@/lib/strava.server");
    const token = await getValidAccessTokenForUser(context.userId);
    if (!token) throw new Error("Strava não está conectado");
    const list = await listRecentActivities(token, data.count);

    let inserted = 0;
    let updated = 0;
    let skipped = 0;
    for (const a of list) {
      try {
        const r = await upsertActivityForUser(context.userId, a.id);
        if (r === "inserted") inserted++;
        else if (r === "updated") updated++;
        else skipped++;
      } catch {
        skipped++;
      }
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("strava_connections")
      .update({ last_sync_at: new Date().toISOString() })
      .eq("user_id", context.userId);

    return { inserted, updated, skipped, total: list.length };
  });

// ------ Sync latest activity or today's activities ------
export const syncStravaLatest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ scope: z.enum(["latest", "today"]).default("latest") }).parse(input ?? {}),
  )
  .handler(async ({ context, data }) => {
    const { getValidAccessTokenForUser, listRecentActivities, listActivitiesSince, upsertActivityForUser } =
      await import("@/lib/strava.server");
    const token = await getValidAccessTokenForUser(context.userId);
    if (!token) throw new Error("Strava não está conectado");

    let list: Array<{ id: number }> = [];
    if (data.scope === "latest") {
      list = await listRecentActivities(token, 1);
    } else {
      // "today" no fuso America/Sao_Paulo
      const now = new Date();
      const saoPauloOffsetMs = -3 * 60 * 60 * 1000;
      const local = new Date(now.getTime() + saoPauloOffsetMs);
      const startLocal = new Date(local.getFullYear(), local.getMonth(), local.getDate());
      const startUtcSec = Math.floor((startLocal.getTime() - saoPauloOffsetMs) / 1000);
      list = await listActivitiesSince(token, startUtcSec, 2);
    }

    let inserted = 0;
    let updated = 0;
    let skipped = 0;
    for (const a of list) {
      try {
        const r = await upsertActivityForUser(context.userId, a.id);
        if (r === "inserted") inserted++;
        else if (r === "updated") updated++;
        else skipped++;
      } catch {
        skipped++;
      }
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("strava_connections")
      .update({ last_sync_at: new Date().toISOString() })
      .eq("user_id", context.userId);

    return { inserted, updated, skipped, total: list.length };
  });

// ------ Ensure a global webhook subscription exists (one per app) ------
export const ensureStravaWebhook = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const clientId = process.env.STRAVA_CLIENT_ID;
    const clientSecret = process.env.STRAVA_CLIENT_SECRET;
    const verifyToken = process.env.STRAVA_WEBHOOK_VERIFY_TOKEN;
    if (!clientId || !clientSecret || !verifyToken) throw new Error("Strava não configurado");

    const origin =
      process.env.PUBLIC_APP_URL || process.env.APP_URL || "https://cargaapp.lovable.app";
    const callbackUrl = `${origin.replace(/\/$/, "")}/api/public/strava/webhook`;

    // Check existing subscriptions
    const listRes = await fetch(
      `https://www.strava.com/api/v3/push_subscriptions?client_id=${clientId}&client_secret=${encodeURIComponent(clientSecret)}`,
    );
    const existing = listRes.ok ? ((await listRes.json()) as Array<{ id: number; callback_url: string }>) : [];
    const already = existing.find((s) => s.callback_url === callbackUrl);
    if (already) return { ok: true, subscriptionId: already.id, alreadyExisted: true };

    const form = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      callback_url: callbackUrl,
      verify_token: verifyToken,
    });
    const res = await fetch("https://www.strava.com/api/v3/push_subscriptions", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form.toString(),
    });
    if (!res.ok) throw new Error(`Falha ao registrar webhook [${res.status}]: ${await res.text()}`);
    const created = (await res.json()) as { id: number };
    return { ok: true, subscriptionId: created.id, alreadyExisted: false };
  });
