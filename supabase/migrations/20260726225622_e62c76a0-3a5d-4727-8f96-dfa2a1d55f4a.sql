CREATE TABLE IF NOT EXISTS public.workout_reminder_settings (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT true,
  remind_at time NOT NULL DEFAULT '09:00',
  rest_days smallint[] NOT NULL DEFAULT '{}',
  timezone text NOT NULL DEFAULT 'America/Sao_Paulo',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.workout_reminder_settings TO authenticated;
GRANT ALL ON public.workout_reminder_settings TO service_role;

ALTER TABLE public.workout_reminder_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own reminder settings" ON public.workout_reminder_settings;
CREATE POLICY "own reminder settings" ON public.workout_reminder_settings
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.touch_workout_reminder_settings()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS trg_touch_workout_reminder_settings ON public.workout_reminder_settings;
CREATE TRIGGER trg_touch_workout_reminder_settings
BEFORE UPDATE ON public.workout_reminder_settings
FOR EACH ROW EXECUTE FUNCTION public.touch_workout_reminder_settings();