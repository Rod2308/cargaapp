CREATE TABLE IF NOT EXISTS public.email_push_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  type text NOT NULL, -- 'workout_reminder', 'session_adjustment', etc.
  status text NOT NULL DEFAULT 'pending', -- 'pending', 'sent', 'failed'
  scheduled_for timestamptz NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}',
  sent_at timestamptz,
  created_at timestamptz DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.email_push_notifications TO authenticated;
GRANT ALL ON public.email_push_notifications TO service_role;

ALTER TABLE public.email_push_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own email/push logs"
  ON public.email_push_notifications
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- 2. Add email preference to workout_reminder_settings if not exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='workout_reminder_settings' AND column_name='email_enabled') THEN
    ALTER TABLE public.workout_reminder_settings ADD COLUMN email_enabled boolean NOT NULL DEFAULT false;
  END IF;
END
$$;
