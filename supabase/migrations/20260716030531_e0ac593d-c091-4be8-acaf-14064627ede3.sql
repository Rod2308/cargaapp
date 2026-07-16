CREATE TABLE public.daily_checkins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  log_date date NOT NULL,
  sleep_hours numeric(3,1) NOT NULL CHECK (sleep_hours >= 0 AND sleep_hours <= 24),
  sleep_quality smallint NOT NULL CHECK (sleep_quality BETWEEN 1 AND 5),
  soreness smallint NOT NULL CHECK (soreness BETWEEN 1 AND 5),
  energy smallint NOT NULL CHECK (energy BETWEEN 1 AND 5),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, log_date)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.daily_checkins TO authenticated;
GRANT ALL ON public.daily_checkins TO service_role;

ALTER TABLE public.daily_checkins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own checkins"
  ON public.daily_checkins
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_daily_checkins_updated_at
  BEFORE UPDATE ON public.daily_checkins
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX daily_checkins_user_date_idx ON public.daily_checkins (user_id, log_date DESC);