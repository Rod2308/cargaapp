CREATE TABLE public.body_measurements (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  log_date date NOT NULL DEFAULT current_date,
  weight_kg numeric,
  body_fat_pct numeric,
  neck_cm numeric,
  shoulder_cm numeric,
  chest_cm numeric,
  arm_cm numeric,
  forearm_cm numeric,
  waist_cm numeric,
  hip_cm numeric,
  thigh_cm numeric,
  calf_cm numeric,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (user_id, log_date)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.body_measurements TO authenticated;
GRANT ALL ON public.body_measurements TO service_role;
ALTER TABLE public.body_measurements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own body measurements" ON public.body_measurements FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER body_measurements_updated_at BEFORE UPDATE ON public.body_measurements FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.progress_photos (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  taken_on date NOT NULL DEFAULT current_date,
  storage_path text NOT NULL,
  pose text,
  note text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.progress_photos TO authenticated;
GRANT ALL ON public.progress_photos TO service_role;
ALTER TABLE public.progress_photos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own progress photos" ON public.progress_photos FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX progress_photos_user_date_idx ON public.progress_photos (user_id, taken_on DESC);

ALTER TABLE public.session_sets ADD COLUMN IF NOT EXISTS notes text;
ALTER TABLE public.session_sets ADD COLUMN IF NOT EXISTS technique text NOT NULL DEFAULT 'normal';
ALTER TABLE public.workout_exercises ADD COLUMN IF NOT EXISTS group_key text;
ALTER TABLE public.workout_exercises ADD COLUMN IF NOT EXISTS technique text NOT NULL DEFAULT 'normal';