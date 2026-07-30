CREATE UNIQUE INDEX IF NOT EXISTS exercises_unique_name_group_owner
  ON public.exercises (
    lower(btrim(name)),
    lower(btrim(muscle_group)),
    COALESCE(created_by, '00000000-0000-0000-0000-000000000000'::uuid)
  );