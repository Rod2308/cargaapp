
CREATE POLICY "Student can view linked trainer profile"
ON public.profiles
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.trainer_students
    WHERE trainer_id = profiles.id AND student_id = auth.uid()
  )
);
