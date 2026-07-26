import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type ReminderSettings = {
  enabled: boolean;
  remindAt: string; // "HH:MM"
  restDays: number[]; // 0=Dom ... 6=Sáb
  timezone: string;
};

export const DEFAULT_REMINDER_SETTINGS: ReminderSettings = {
  enabled: true,
  remindAt: "09:00",
  restDays: [],
  timezone: "America/Sao_Paulo",
};

const SettingsSchema = z.object({
  enabled: z.boolean(),
  remindAt: z.string().regex(/^\d{2}:\d{2}$/),
  restDays: z.array(z.number().int().min(0).max(6)).max(7),
  timezone: z.string().min(1).max(64),
});

export const getReminderSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ReminderSettings> => {
    const { supabase, userId } = context;
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
  });

export const saveReminderSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => SettingsSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
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
  });
