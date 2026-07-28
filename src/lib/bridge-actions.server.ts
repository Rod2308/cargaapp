// Implementações server-side compartilhadas.
//
// Cada função aqui é a "fonte da verdade" de uma operação do app. Elas são
// usadas por duas portas de entrada:
//   1. as server functions (`*.functions.ts`) — usadas no domínio canônico;
//   2. a rota-ponte `/api/public/bridge` — usada pelo domínio espelho, que é
//      servido como site estático e não tem server functions próprias.
//
// Assim os dois domínios executam exatamente o mesmo código, com as mesmas
// regras, validações e mensagens de erro.

import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { computeRecoveryAdviceFor, type RecoveryAdvice } from "@/lib/recovery-core";
import { DEFAULT_REMINDER_SETTINGS, type ReminderSettings } from "@/lib/reminder-settings.shared";

export type SB = SupabaseClient<Database>;

const CANONICAL_APP_ORIGIN = "https://cargaapp.lovable.app";

function appOrigin() {
  const origin = process.env.PUBLIC_APP_URL || process.env.APP_URL || CANONICAL_APP_ORIGIN;
  return origin.replace(/\/$/, "");
}

/* ------------------------------------------------------------------ */
/* Convites públicos de grupo                                          */
/* ------------------------------------------------------------------ */

export const InviteInput = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9-]{4,12}$/),
});

export type PublicInvite = {
  name: string;
  description: string | null;
  emoji: string | null;
  member_count: number;
  is_archived: boolean;
} | null;

export async function getPublicInviteAction(input: unknown): Promise<PublicInvite> {
  const data = InviteInput.parse(input);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: rows, error } = await supabaseAdmin.rpc("get_group_public_invite", {
    _code: data.code,
  });
  if (error) return null;
  const row = Array.isArray(rows) ? rows[0] : rows;
  if (!row) return null;
  return {
    name: row.name,
    description: row.description,
    emoji: row.emoji,
    member_count: Number(row.member_count ?? 0),
    is_archived: !!row.is_archived,
  };
}

/* ------------------------------------------------------------------ */
/* Recuperação                                                         */
/* ------------------------------------------------------------------ */

export async function getRecoveryAdviceAction(supabase: SB, userId: string): Promise<RecoveryAdvice> {
  try {
    return await computeRecoveryAdviceFor(supabase, userId);
  } catch (error) {
    console.error("[recovery] failed:", error instanceof Error ? error.message : error);
    throw new Error(
      "Não foi possível calcular sua recuperação agora. Tente novamente em alguns instantes.",
    );
  }
}

/* ------------------------------------------------------------------ */
/* Preferências de lembrete de treino                                  */
/* ------------------------------------------------------------------ */

export const ReminderSettingsSchema = z.object({
  enabled: z.boolean(),
  remindAt: z.string().regex(/^\d{2}:\d{2}$/),
  restDays: z.array(z.number().int().min(0).max(6)).max(7),
  timezone: z.string().min(1).max(64),
});

export async function getReminderSettingsAction(supabase: SB, userId: string): Promise<ReminderSettings> {
  const { data, error } = await supabase
    .from("workout_reminder_settings")
    .select("enabled, remind_at, rest_days, timezone")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return DEFAULT_REMINDER_SETTINGS;
  return {
    enabled: data.enabled,
    remindAt: String(data.remind_at).slice(0, 5),
    restDays: (data.rest_days ?? []) as number[],
    timezone: data.timezone ?? DEFAULT_REMINDER_SETTINGS.timezone,
  };
}

export async function saveReminderSettingsAction(supabase: SB, userId: string, input: unknown) {
  const data = ReminderSettingsSchema.parse(input);
  const { error } = await supabase.from("workout_reminder_settings").upsert(
    {
      user_id: userId,
      enabled: data.enabled,
      remind_at: `${data.remindAt}:00`,
      rest_days: data.restDays,
      timezone: data.timezone,
    },
    { onConflict: "user_id" },
  );
  if (error) throw new Error(error.message);
  return { ok: true };
}

/* ------------------------------------------------------------------ */
/* Web Push                                                            */
/* ------------------------------------------------------------------ */

export const SubscriptionSchema = z.object({
  endpoint: z.string().url().max(2000),
  p256dh: z.string().min(1).max(500),
  auth: z.string().min(1).max(500),
  userAgent: z.string().max(500).optional(),
});

export function getVapidPublicKeyAction() {
  const key = process.env.VAPID_PUBLIC_KEY;
  if (!key) throw new Error("VAPID_PUBLIC_KEY não configurada no servidor");
  return { publicKey: key };
}

export async function savePushSubscriptionAction(supabase: SB, userId: string, input: unknown) {
  const data = SubscriptionSchema.parse(input);
  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      user_id: userId,
      endpoint: data.endpoint,
      p256dh: data.p256dh,
      auth: data.auth,
      user_agent: data.userAgent ?? null,
      last_seen_at: new Date().toISOString(),
    },
    { onConflict: "user_id,endpoint" },
  );
  if (error) throw new Error(error.message);
  return { ok: true };
}

export async function deletePushSubscriptionAction(supabase: SB, userId: string, input: unknown) {
  const data = z.object({ endpoint: z.string().url().max(2000) }).parse(input);
  const { error } = await supabase
    .from("push_subscriptions")
    .delete()
    .eq("user_id", userId)
    .eq("endpoint", data.endpoint);
  if (error) throw new Error(error.message);
  return { ok: true };
}

/* ------------------------------------------------------------------ */
/* Push de fim de descanso                                             */
/* ------------------------------------------------------------------ */

export const RestScheduleSchema = z.object({
  seconds: z.number().int().min(5).max(60 * 60),
  exerciseName: z.string().max(120).optional(),
});

export async function scheduleRestPushAction(supabase: SB, userId: string, input: unknown) {
  const data = RestScheduleSchema.parse(input);
  const fireAt = new Date(Date.now() + data.seconds * 1000).toISOString();
  const body = data.exerciseName
    ? `Volte para: ${data.exerciseName}`
    : "Hora de voltar para a próxima série!";
  await supabase.from("rest_push_schedules").delete().eq("user_id", userId).is("sent_at", null);
  const { error } = await supabase.from("rest_push_schedules").insert({
    user_id: userId,
    fire_at: fireAt,
    title: "Descanso concluído",
    body,
  });
  if (error) throw new Error(error.message);
  return { ok: true, fireAt };
}

export async function cancelRestPushAction(supabase: SB, userId: string) {
  const { error } = await supabase
    .from("rest_push_schedules")
    .delete()
    .eq("user_id", userId)
    .is("sent_at", null);
  if (error) throw new Error(error.message);
  return { ok: true };
}

/* ------------------------------------------------------------------ */
/* Professor / alunos                                                  */
/* ------------------------------------------------------------------ */

export async function listStudentsAction(supabase: SB, userId: string) {
  const { data: isTrainer } = await supabase.rpc("has_role", {
    _user_id: userId,
    _role: "trainer",
  });
  if (!isTrainer) throw new Error("Apenas professores acessam esta área.");

  const { data: links, error } = await supabase
    .from("trainer_students")
    .select("student_id, created_at")
    .eq("trainer_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  const ids = (links ?? []).map((l) => l.student_id);
  if (ids.length === 0)
    return { students: [] as Array<{ id: string; display_name: string | null; created_at: string }> };

  const { data: profiles } = await supabase.from("profiles").select("id, display_name").in("id", ids);
  const byId = new Map((profiles ?? []).map((p) => [p.id, p]));
  return {
    students: (links ?? []).map((l) => ({
      id: l.student_id,
      display_name: byId.get(l.student_id)?.display_name ?? null,
      created_at: l.created_at,
    })),
  };
}

const CodeInput = z.object({ invite_code: z.string().trim().min(4).max(20) });

export async function linkStudentByCodeAction(supabase: SB, userId: string, input: unknown) {
  const data = CodeInput.parse(input);
  const { data: isTrainer } = await supabase.rpc("has_role", {
    _user_id: userId,
    _role: "trainer",
  });
  if (!isTrainer) throw new Error("Apenas professores podem vincular alunos.");

  const code = data.invite_code.toUpperCase();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: student } = await supabaseAdmin
    .from("profiles")
    .select("id, display_name")
    .eq("invite_code", code)
    .maybeSingle();
  if (!student) throw new Error("Código não encontrado.");
  if (student.id === userId) throw new Error("Você não pode se vincular a si mesmo.");

  const { error } = await supabaseAdmin
    .from("trainer_students")
    .insert({ trainer_id: userId, student_id: student.id });
  if (error) {
    if (error.code === "23505") throw new Error("Este aluno já tem um professor vinculado.");
    throw error;
  }
  return { student: { id: student.id, display_name: student.display_name } };
}

export async function unlinkStudentAction(supabase: SB, userId: string, input: unknown) {
  const data = z.object({ student_id: z.string().uuid() }).parse(input);
  const { error } = await supabase
    .from("trainer_students")
    .delete()
    .eq("trainer_id", userId)
    .eq("student_id", data.student_id);
  if (error) throw error;
  return { ok: true };
}

export async function getStudentDetailsAction(supabase: SB, userId: string, input: unknown) {
  const data = z.object({ student_id: z.string().uuid() }).parse(input);
  const { data: linked } = await supabase.rpc("is_trainer_of", {
    _trainer: userId,
    _student: data.student_id,
  });
  if (!linked) throw new Error("Aluno não vinculado a você.");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, display_name, goal, experience_level, weekly_frequency, injuries")
    .eq("id", data.student_id)
    .maybeSingle();

  const { data: workouts } = await supabase
    .from("workouts")
    .select("id, label, name, notes, created_by_trainer_id, order_idx")
    .eq("user_id", data.student_id)
    .order("order_idx");

  return { profile, workouts: workouts ?? [] };
}

export async function getMyTrainerAction(supabase: SB, userId: string) {
  const { data: link } = await supabase
    .from("trainer_students")
    .select("trainer_id, created_at")
    .eq("student_id", userId)
    .maybeSingle();
  if (!link) return { trainer: null };

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, display_name, cref, city, specialties, bio, contact_phone")
    .eq("id", link.trainer_id)
    .maybeSingle();
  return { trainer: profile ? { ...profile, linked_at: link.created_at } : null };
}

export async function linkTrainerByCodeAction(supabase: SB, userId: string, input: unknown) {
  const data = CodeInput.parse(input);
  const { data: existing } = await supabase
    .from("trainer_students")
    .select("trainer_id")
    .eq("student_id", userId)
    .maybeSingle();
  if (existing)
    throw new Error("Você já está vinculado a um professor. Desvincule antes de trocar.");

  const code = data.invite_code.toUpperCase();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: trainerProfile } = await supabaseAdmin
    .from("profiles")
    .select("id, display_name")
    .eq("invite_code", code)
    .maybeSingle();
  if (!trainerProfile) throw new Error("Código não encontrado.");
  if (trainerProfile.id === userId) throw new Error("Você não pode se vincular a si mesmo.");

  const { data: isTrainer } = await supabaseAdmin.rpc("has_role", {
    _user_id: trainerProfile.id,
    _role: "trainer",
  });
  if (!isTrainer) throw new Error("Este código não pertence a um professor.");

  const { error } = await supabaseAdmin
    .from("trainer_students")
    .insert({ trainer_id: trainerProfile.id, student_id: userId });
  if (error) {
    if (error.code === "23505") throw new Error("Vínculo já existe.");
    throw error;
  }
  return { trainer: trainerProfile };
}

export async function unlinkMyTrainerAction(supabase: SB, userId: string) {
  const { error } = await supabase.from("trainer_students").delete().eq("student_id", userId);
  if (error) throw error;
  return { ok: true };
}

/* ------------------------------------------------------------------ */
/* Strava                                                              */
/* ------------------------------------------------------------------ */

export async function getStravaStatusAction(_supabase: SB, userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("strava_connections")
    .select("strava_athlete_id, last_sync_at, scope, created_at")
    .eq("user_id", userId)
    .maybeSingle();
  return {
    connected: !!data,
    athleteId: (data?.strava_athlete_id as number | undefined) ?? null,
    lastSyncAt: (data?.last_sync_at as string | null | undefined) ?? null,
    scope: (data?.scope as string | null | undefined) ?? null,
  };
}

export async function getStravaAuthorizeUrlAction(_supabase: SB, userId: string) {
  const clientId = process.env.STRAVA_CLIENT_ID;
  if (!clientId) throw new Error("STRAVA_CLIENT_ID is not configured");
  const { signState, STRAVA_OAUTH_AUTHORIZE, STRAVA_SCOPE } = await import("@/lib/strava.server");
  const redirectUri = `${appOrigin()}/api/public/strava/callback`;
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    redirect_uri: redirectUri,
    approval_prompt: "auto",
    scope: STRAVA_SCOPE,
    state: signState(userId),
  });
  return { url: `${STRAVA_OAUTH_AUTHORIZE}?${params.toString()}` };
}

export async function disconnectStravaAction(_supabase: SB, userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { getValidAccessTokenForUser } = await import("@/lib/strava.server");
  try {
    const token = await getValidAccessTokenForUser(userId);
    if (token) {
      await fetch("https://www.strava.com/oauth/deauthorize", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
    }
  } catch {
    // best-effort
  }
  await supabaseAdmin.from("strava_connections").delete().eq("user_id", userId);
  return { ok: true };
}

async function importActivities(userId: string, list: Array<{ id: number }>) {
  const { upsertActivityForUser } = await import("@/lib/strava.server");
  let inserted = 0;
  let updated = 0;
  let skipped = 0;
  for (const a of list) {
    try {
      const r = await upsertActivityForUser(userId, a.id);
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
    .eq("user_id", userId);
  return { inserted, updated, skipped, total: list.length };
}

export async function backfillStravaAction(_supabase: SB, userId: string, input: unknown) {
  const data = z.object({ count: z.number().int().min(1).max(100).default(30) }).parse(input ?? {});
  const { getValidAccessTokenForUser, listRecentActivities } = await import("@/lib/strava.server");
  const token = await getValidAccessTokenForUser(userId);
  if (!token) throw new Error("Strava não está conectado");
  const list = await listRecentActivities(token, data.count);
  return importActivities(userId, list);
}

export async function syncStravaLatestAction(_supabase: SB, userId: string, input: unknown) {
  const data = z.object({ scope: z.enum(["latest", "today"]).default("latest") }).parse(input ?? {});
  const { getValidAccessTokenForUser, listRecentActivities, listActivitiesSince } = await import(
    "@/lib/strava.server"
  );
  const token = await getValidAccessTokenForUser(userId);
  if (!token) throw new Error("Strava não está conectado");

  let list: Array<{ id: number }> = [];
  if (data.scope === "latest") {
    list = await listRecentActivities(token, 1);
  } else {
    const now = new Date();
    const saoPauloOffsetMs = -3 * 60 * 60 * 1000;
    const local = new Date(now.getTime() + saoPauloOffsetMs);
    const startLocal = new Date(local.getFullYear(), local.getMonth(), local.getDate());
    const startUtcSec = Math.floor((startLocal.getTime() - saoPauloOffsetMs) / 1000);
    list = await listActivitiesSince(token, startUtcSec, 2);
  }
  return importActivities(userId, list);
}

export async function ensureStravaWebhookAction() {
  const clientId = process.env.STRAVA_CLIENT_ID;
  const clientSecret = process.env.STRAVA_CLIENT_SECRET;
  const verifyToken = process.env.STRAVA_WEBHOOK_VERIFY_TOKEN;
  if (!clientId || !clientSecret || !verifyToken) throw new Error("Strava não configurado");

  const callbackUrl = `${appOrigin()}/api/public/strava/webhook`;

  const listRes = await fetch(
    `https://www.strava.com/api/v3/push_subscriptions?client_id=${clientId}&client_secret=${encodeURIComponent(clientSecret)}`,
  );
  const existing = listRes.ok
    ? ((await listRes.json()) as Array<{ id: number; callback_url: string }>)
    : [];
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
}

/* ------------------------------------------------------------------ */
/* Registro de ações usado pela rota-ponte                             */
/* ------------------------------------------------------------------ */

type AuthedAction = (supabase: SB, userId: string, payload: unknown) => Promise<unknown>;

export const AUTHED_ACTIONS: Record<string, AuthedAction> = {
  "recovery.get": (sb, uid) => getRecoveryAdviceAction(sb, uid),
  "reminders.get": (sb, uid) => getReminderSettingsAction(sb, uid),
  "reminders.save": (sb, uid, p) => saveReminderSettingsAction(sb, uid, p),
  "push.save": (sb, uid, p) => savePushSubscriptionAction(sb, uid, p),
  "push.delete": (sb, uid, p) => deletePushSubscriptionAction(sb, uid, p),
  "rest.schedule": (sb, uid, p) => scheduleRestPushAction(sb, uid, p),
  "rest.cancel": (sb, uid) => cancelRestPushAction(sb, uid),
  "trainer.listStudents": (sb, uid) => listStudentsAction(sb, uid),
  "trainer.linkStudentByCode": (sb, uid, p) => linkStudentByCodeAction(sb, uid, p),
  "trainer.unlinkStudent": (sb, uid, p) => unlinkStudentAction(sb, uid, p),
  "trainer.getStudentDetails": (sb, uid, p) => getStudentDetailsAction(sb, uid, p),
  "trainer.getMyTrainer": (sb, uid) => getMyTrainerAction(sb, uid),
  "trainer.linkTrainerByCode": (sb, uid, p) => linkTrainerByCodeAction(sb, uid, p),
  "trainer.unlinkMyTrainer": (sb, uid) => unlinkMyTrainerAction(sb, uid),
  "strava.status": (sb, uid) => getStravaStatusAction(sb, uid),
  "strava.authorizeUrl": (sb, uid) => getStravaAuthorizeUrlAction(sb, uid),
  "strava.disconnect": (sb, uid) => disconnectStravaAction(sb, uid),
  "strava.backfill": (sb, uid, p) => backfillStravaAction(sb, uid, p),
  "strava.sync": (sb, uid, p) => syncStravaLatestAction(sb, uid, p),
  "strava.ensureWebhook": () => ensureStravaWebhookAction(),
};

type PublicAction = (payload: unknown) => Promise<unknown>;

export const PUBLIC_ACTIONS: Record<string, PublicAction> = {
  "invites.getPublicInvite": (p) => getPublicInviteAction(p),
  "push.vapid": async () => getVapidPublicKeyAction(),
};
