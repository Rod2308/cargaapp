
-- Fix profiles trainer-view policy: restrict to authenticated
DROP POLICY IF EXISTS "Student can view linked trainer profile" ON public.profiles;
CREATE POLICY "Student can view linked trainer profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.trainer_students
  WHERE trainer_students.trainer_id = profiles.id
    AND trainer_students.student_id = auth.uid()
));

-- Fix sleep_logs policy: restrict to authenticated
DROP POLICY IF EXISTS "Users manage own sleep logs" ON public.sleep_logs;
CREATE POLICY "Users manage own sleep logs"
ON public.sleep_logs
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Storage policies for exercise-images bucket
DROP POLICY IF EXISTS "Exercise images are publicly viewable" ON storage.objects;
CREATE POLICY "Exercise images are publicly viewable"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'exercise-images');

DROP POLICY IF EXISTS "Trainers can upload exercise images" ON storage.objects;
CREATE POLICY "Trainers can upload exercise images"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'exercise-images'
  AND public.has_role(auth.uid(), 'trainer')
  AND owner = auth.uid()
);

DROP POLICY IF EXISTS "Trainers can update own exercise images" ON storage.objects;
CREATE POLICY "Trainers can update own exercise images"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'exercise-images' AND owner = auth.uid())
WITH CHECK (bucket_id = 'exercise-images' AND owner = auth.uid());

DROP POLICY IF EXISTS "Trainers can delete own exercise images" ON storage.objects;
CREATE POLICY "Trainers can delete own exercise images"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'exercise-images' AND owner = auth.uid());
