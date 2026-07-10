ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS cycle_tracking_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS cycle_last_period_start date,
  ADD COLUMN IF NOT EXISTS cycle_length_days integer NOT NULL DEFAULT 28,
  ADD COLUMN IF NOT EXISTS cycle_period_length_days integer NOT NULL DEFAULT 5;