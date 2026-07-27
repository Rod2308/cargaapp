// Fallback 100% cliente para as preferências de lembrete de treino.
// Usado quando o app está hospedado como site estático (domínio espelho),
// onde as server functions não existem. Os dados e as regras são os mesmos:
// tabela workout_reminder_settings, protegida por RLS (user_id = auth.uid()).

import { supabase } from "@/integrations/supabase/client";
import {
  DEFAULT_REMINDER_SETTINGS,
  type ReminderSettings,
} from "@/lib/reminder-settings.functions";

export async function loadReminderSettingsClient(): Promise<ReminderSettings> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) return DEFAULT_REMINDER_SETTINGS;

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

export async function saveReminderSettingsClient(next: ReminderSettings) {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) throw new Error("Sessão expirada. Entre novamente.");

  const { error } = await supabase.from("workout_reminder_settings").upsert(
    {
      user_id: userId,
      enabled: next.enabled,
      remind_at: `${next.remindAt}:00`,
      rest_days: next.restDays,
      timezone: next.timezone,
    },
    { onConflict: "user_id" },
  );
  if (error) throw new Error(error.message);
  return { ok: true };
}
