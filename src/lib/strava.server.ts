// Server-only helpers for the Strava integration.
// Do not import from route components or *.functions.ts at module scope
// unless the caller is itself server-only.

import { createHmac, timingSafeEqual } from "node:crypto";

export const STRAVA_OAUTH_AUTHORIZE = "https://www.strava.com/oauth/authorize";
export const STRAVA_OAUTH_TOKEN = "https://www.strava.com/oauth/token";
export const STRAVA_API = "https://www.strava.com/api/v3";
export const STRAVA_SCOPE = "read,activity:read_all";

export type StravaTokens = {
  access_token: string;
  refresh_token: string;
  expires_at: number; // unix seconds
  athlete?: { id: number };
  scope?: string;
};

// --- Signed OAuth state (prevents CSRF and identifies the user in the callback)

function stateSecret(): string {
  const s = process.env.STRAVA_OAUTH_STATE_SECRET;
  if (!s) throw new Error("STRAVA_OAUTH_STATE_SECRET is not set");
  return s;
}

export function signState(userId: string): string {
  const nonce = Math.random().toString(36).slice(2, 10);
  const payload = `${userId}.${Date.now()}.${nonce}`;
  const sig = createHmac("sha256", stateSecret()).update(payload).digest("base64url");
  return `${Buffer.from(payload).toString("base64url")}.${sig}`;
}

export function verifyState(state: string): { userId: string } | null {
  try {
    const [b64, sig] = state.split(".");
    if (!b64 || !sig) return null;
    const payload = Buffer.from(b64, "base64url").toString("utf8");
    const expected = createHmac("sha256", stateSecret()).update(payload).digest("base64url");
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
    const [userId, tsStr] = payload.split(".");
    const ts = Number(tsStr);
    if (!userId || !ts) return null;
    // 15 minute validity
    if (Date.now() - ts > 15 * 60 * 1000) return null;
    return { userId };
  } catch {
    return null;
  }
}

// --- Token exchange / refresh

export async function exchangeCode(code: string): Promise<StravaTokens> {
  const res = await fetch(STRAVA_OAUTH_TOKEN, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: process.env.STRAVA_CLIENT_ID,
      client_secret: process.env.STRAVA_CLIENT_SECRET,
      code,
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) throw new Error(`Strava token exchange failed [${res.status}]: ${await res.text()}`);
  return (await res.json()) as StravaTokens;
}

export async function refreshToken(refresh_token: string): Promise<StravaTokens> {
  const res = await fetch(STRAVA_OAUTH_TOKEN, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: process.env.STRAVA_CLIENT_ID,
      client_secret: process.env.STRAVA_CLIENT_SECRET,
      grant_type: "refresh_token",
      refresh_token,
    }),
  });
  if (!res.ok) throw new Error(`Strava refresh failed [${res.status}]: ${await res.text()}`);
  return (await res.json()) as StravaTokens;
}

// Returns a valid access token, refreshing (and persisting) if needed.
export async function getValidAccessTokenForUser(userId: string): Promise<string | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: conn } = await supabaseAdmin
    .from("strava_connections")
    .select("access_token, refresh_token, expires_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (!conn) return null;

  const expiresAtMs = new Date(conn.expires_at as string).getTime();
  // Refresh 2 min before expiration.
  if (expiresAtMs - Date.now() > 2 * 60 * 1000) return conn.access_token as string;

  const fresh = await refreshToken(conn.refresh_token as string);
  await supabaseAdmin
    .from("strava_connections")
    .update({
      access_token: fresh.access_token,
      refresh_token: fresh.refresh_token,
      expires_at: new Date(fresh.expires_at * 1000).toISOString(),
    })
    .eq("user_id", userId);
  return fresh.access_token;
}

// --- Strava sport → app activity_type mapping

// Strava "sport_type" (preferred, richer) or older "type".
export function mapStravaSportToActivityType(sport: string | undefined): string {
  if (!sport) return "outros";
  const s = sport.toLowerCase();
  if (s.includes("run") || s === "trailrun" || s === "virtualrun") return "corrida";
  if (s.includes("walk") || s === "hike") return "caminhada";
  if (s.includes("ride") || s === "ebikeride" || s === "virtualride" || s === "gravelride" || s === "mountainbikeride")
    return "ciclismo";
  if (s.includes("swim")) return "natacao";
  if (s === "weighttraining" || s === "workout" || s === "crossfit" || s === "elliptical") return "musculacao";
  if (s === "yoga" || s === "pilates") return "mobilidade";
  return "outros";
}

// --- Import a single activity

// Strava "detailed activity" fields we consume
type StravaActivityDetail = {
  id: number;
  name?: string;
  sport_type?: string;
  type?: string;
  start_date?: string;
  elapsed_time?: number;
  moving_time?: number;
  distance?: number;
  average_heartrate?: number;
  max_heartrate?: number;
  calories?: number;
  total_elevation_gain?: number;
};

export async function fetchActivity(accessToken: string, activityId: number | string): Promise<StravaActivityDetail | null> {
  const res = await fetch(`${STRAVA_API}/activities/${activityId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Strava activity fetch failed [${res.status}]: ${await res.text()}`);
  return (await res.json()) as StravaActivityDetail;
}

export async function listRecentActivities(accessToken: string, perPage = 30): Promise<StravaActivityDetail[]> {
  const res = await fetch(`${STRAVA_API}/athlete/activities?per_page=${perPage}&page=1`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Strava list failed [${res.status}]: ${await res.text()}`);
  return (await res.json()) as StravaActivityDetail[];
}

function activityToSessionRow(userId: string, a: StravaActivityDetail) {
  const started = a.start_date ? new Date(a.start_date) : new Date();
  const duration = (a.elapsed_time ?? a.moving_time ?? 0) * 1000;
  const ended = new Date(started.getTime() + duration);
  return {
    user_id: userId,
    strava_activity_id: a.id,
    started_at: started.toISOString(),
    ended_at: ended.toISOString(),
    activity_type: mapStravaSportToActivityType(a.sport_type ?? a.type),
    distance_m: typeof a.distance === "number" ? Math.round(a.distance) : null,
    avg_hr: typeof a.average_heartrate === "number" ? Math.round(a.average_heartrate) : null,
    max_hr: typeof a.max_heartrate === "number" ? Math.round(a.max_heartrate) : null,
    calories: typeof a.calories === "number" ? Math.round(a.calories) : null,
    elevation_gain_m: typeof a.total_elevation_gain === "number" ? Math.round(a.total_elevation_gain) : null,
    source: "strava",
    import_source: "strava",
    title: (a.name ?? "").slice(0, 80) || null,
  };
}

export async function upsertActivityForUser(userId: string, activityId: number | string): Promise<"inserted" | "updated" | "skipped"> {
  const token = await getValidAccessTokenForUser(userId);
  if (!token) return "skipped";
  const activity = await fetchActivity(token, activityId);
  if (!activity) return "skipped";
  const row = activityToSessionRow(userId, activity);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  // Try update first (dedup by user_id + strava_activity_id).
  const { data: existing } = await supabaseAdmin
    .from("sessions")
    .select("id")
    .eq("user_id", userId)
    .eq("strava_activity_id", row.strava_activity_id)
    .maybeSingle();

  if (existing) {
    await supabaseAdmin.from("sessions").update(row).eq("id", existing.id);
    return "updated";
  }
  await supabaseAdmin.from("sessions").insert(row);
  return "inserted";
}

export async function deleteActivityForUser(userId: string, activityId: number | string): Promise<boolean> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await supabaseAdmin
    .from("sessions")
    .delete()
    .eq("user_id", userId)
    .eq("strava_activity_id", Number(activityId));
  return !error;
}

export async function findUserIdByAthleteId(athleteId: number | string): Promise<string | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("strava_connections")
    .select("user_id")
    .eq("strava_athlete_id", Number(athleteId))
    .maybeSingle();
  return (data?.user_id as string | undefined) ?? null;
}
