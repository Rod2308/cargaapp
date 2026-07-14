-- Fix trainer_students privilege escalation:
-- previously any student could unilaterally attach themselves to any trainer
-- from the client, bypassing the invite-code flow. The legitimate flow
-- (linkTrainerByCode server function) uses the service-role client after
-- validating the code, so no client INSERT policy is needed.
DROP POLICY IF EXISTS "Student accepts trainer link" ON public.trainer_students;
DROP POLICY IF EXISTS "Trainer creates link for self" ON public.trainer_students;

-- Tighten DELETE: only the student may unlink themselves via the client.
DROP POLICY IF EXISTS "Trainer or student can delete link" ON public.trainer_students;
CREATE POLICY "Student can unlink self"
ON public.trainer_students FOR DELETE
TO authenticated
USING (auth.uid() = student_id);

-- Reflect no-client-insert in grants.
REVOKE INSERT ON public.trainer_students FROM authenticated;

-- Realtime broadcast authorization on messages:
-- public.messages SELECT RLS already gates postgres_changes to conversation
-- participants. Add an explicit authenticated-only policy on realtime.messages
-- so no anonymous client can subscribe to messages broadcast channels.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'realtime' AND c.relname = 'messages'
  ) THEN
    EXECUTE 'ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "authenticated can use realtime" ON realtime.messages';
    EXECUTE 'CREATE POLICY "authenticated can use realtime" ON realtime.messages FOR SELECT TO authenticated USING (true)';
  END IF;
END $$;