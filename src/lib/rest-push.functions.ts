import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const ScheduleSchema = z.object({
  seconds: z.number().int().min(5).max(60 * 60),
  exerciseName: z.string().max(120).optional(),
});

export const scheduleRestPush = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ScheduleSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const fireAt = new Date(Date.now() + data.seconds * 1000).toISOString();
    const body = data.exerciseName
      ? `Volte para: ${data.exerciseName}`
      : "Hora de voltar para a próxima série!";
    // Cancela agendamentos pendentes anteriores (só um timer ativo por vez).
    await supabase.from("rest_push_schedules").delete().eq("user_id", userId).is("sent_at", null);
    const { error } = await supabase.from("rest_push_schedules").insert({
      user_id: userId,
      fire_at: fireAt,
      title: "Descanso concluído",
      body,
    });
    if (error) throw new Error(error.message);
    return { ok: true, fireAt };
  });

export const cancelRestPush = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("rest_push_schedules")
      .delete()
      .eq("user_id", userId)
      .is("sent_at", null);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
