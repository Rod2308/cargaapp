
ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS distance_m integer,
  ADD COLUMN IF NOT EXISTS avg_hr integer,
  ADD COLUMN IF NOT EXISTS max_hr integer,
  ADD COLUMN IF NOT EXISTS calories integer,
  ADD COLUMN IF NOT EXISTS activity_type text,
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'manual';
