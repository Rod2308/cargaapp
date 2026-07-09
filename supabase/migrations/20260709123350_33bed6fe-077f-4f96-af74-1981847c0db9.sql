
-- 1. Restrict exercises SELECT: only default exercises are public; users see their own custom ones
DROP POLICY IF EXISTS exercises_read_all ON public.exercises;

CREATE POLICY exercises_read_default_public
ON public.exercises FOR SELECT
TO anon, authenticated
USING (is_default = true);

CREATE POLICY exercises_read_own_custom
ON public.exercises FOR SELECT
TO authenticated
USING (is_default = false AND auth.uid() = created_by);

-- 2. Prevent trainers/owners from moving a workout_exercise to a different workout
CREATE OR REPLACE FUNCTION public.prevent_workout_exercise_reassignment()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.workout_id IS DISTINCT FROM OLD.workout_id THEN
    RAISE EXCEPTION 'workout_id cannot be changed on workout_exercises';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_workout_exercise_reassignment ON public.workout_exercises;
CREATE TRIGGER trg_prevent_workout_exercise_reassignment
BEFORE UPDATE ON public.workout_exercises
FOR EACH ROW EXECUTE FUNCTION public.prevent_workout_exercise_reassignment();

-- 3. Remove broad public listing on exercise-images storage bucket.
-- Public URLs continue to serve files directly; RLS SELECT was only enabling API listing.
DROP POLICY IF EXISTS "Public read exercise images" ON storage.objects;
