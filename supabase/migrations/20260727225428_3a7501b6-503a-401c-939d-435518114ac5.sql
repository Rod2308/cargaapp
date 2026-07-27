-- 1. Ensure private schema is used for all security-critical checks
CREATE SCHEMA IF NOT EXISTS private;

-- 2. Secure has_role (SECURITY DEFINER + search_path)
CREATE OR REPLACE FUNCTION private.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- 3. Secure is_trainer_of (SECURITY DEFINER + search_path)
CREATE OR REPLACE FUNCTION private.is_trainer_of(_trainer uuid, _student uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.trainer_students
    WHERE trainer_id = _trainer
      AND student_id = _student
  )
$$;

-- 4. Secure handle_new_user (Ensure search_path)
ALTER FUNCTION public.handle_new_user() SET search_path = public;

-- 5. Secure award_group_points_on_session (Ensure search_path)
ALTER FUNCTION public.award_group_points_on_session() SET search_path = public;

-- 6. Secure get_group_public_invite (Ensure search_path)
ALTER FUNCTION public.get_group_public_invite(text) SET search_path = public;

-- 7. Secure push notification triggers (Ensure search_path)
ALTER FUNCTION public.enqueue_push_direct_message() SET search_path = public;
ALTER FUNCTION public.enqueue_push_group_message() SET search_path = public;

-- 8. Enable RLS on all public tables (Defense in Depth)
DO $$
DECLARE
    t text;
BEGIN
    FOR t IN 
        SELECT tablename 
        FROM pg_tables 
        WHERE schemaname = 'public'
    LOOP
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    END LOOP;
END $$;

-- 9. Grant necessary permissions to service_role (Crucial for TanStack server functions)
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO service_role;

-- 10. Grant select on user_roles to authenticated for role checks
GRANT SELECT ON public.user_roles TO authenticated;
REVOKE ALL ON public.user_roles FROM anon;

-- 11. Remove redundant policies on workouts and workout_exercises
DROP POLICY IF EXISTS "workouts_own" ON public.workouts;
DROP POLICY IF EXISTS "we_own" ON public.workout_exercises;
