
-- 1) Explicit SELECT policy on storage.objects for the public exercise-images bucket
DROP POLICY IF EXISTS "Public read exercise images" ON storage.objects;
CREATE POLICY "Public read exercise images"
ON storage.objects
FOR SELECT
TO anon, authenticated
USING (bucket_id = 'exercise-images');

-- 2) Remove trainer self-insert escalation. Only the student themselves may create
-- the link directly via RLS; the trainer flow must go through the server function
-- (which uses the service role after verifying the student's invite code).
DROP POLICY IF EXISTS "Trainer creates link for self" ON public.trainer_students;

CREATE POLICY "Student accepts trainer link"
ON public.trainer_students
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = student_id
  AND public.has_role(trainer_id, 'trainer')
);
