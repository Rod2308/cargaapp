import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { DEFAULT_REMINDER_SETTINGS, type ReminderSettings } from "./reminder-settings.shared";

export { DEFAULT_REMINDER_SETTINGS };
export type { ReminderSettings };

export const getReminderSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ReminderSettings> => {
    const { getReminderSettingsAction } = await import("./bridge-actions.server");
    return getReminderSettingsAction(context.supabase, context.userId);
  });

export const saveReminderSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => input)
  .handler(async ({ data, context }) => {
    const { saveReminderSettingsAction } = await import("./bridge-actions.server");
    return saveReminderSettingsAction(context.supabase, context.userId, data);
  });

export const sendTestEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { sendTestEmailAction } = await import("./bridge-actions.server");
    return sendTestEmailAction(context.supabase, context.userId);
  });
