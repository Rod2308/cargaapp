DROP POLICY IF EXISTS "own rest schedules" ON public.rest_push_schedules;
CREATE POLICY "own rest schedules" ON public.rest_push_schedules
FOR ALL TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);
REVOKE ALL ON public.rest_push_schedules FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rest_push_schedules TO authenticated;
GRANT ALL ON public.rest_push_schedules TO service_role;