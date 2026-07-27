-- 1. Create private schema if not exists
CREATE SCHEMA IF NOT EXISTS private;

-- 2. Move sensitive helper functions to private schema
CREATE OR REPLACE FUNCTION private.is_group_member(_group_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.group_members
    WHERE group_id = _group_id AND user_id = _user_id
  );
$$;

CREATE OR REPLACE FUNCTION private.is_group_owner(_group_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.groups
    WHERE id = _group_id AND owner_id = _user_id
  );
$$;

-- 3. Fix redundant policies on workouts and workout_exercises
-- We keep the most specific/combined ones and drop the duplicates.
DROP POLICY IF EXISTS "workouts_own" ON public.workouts;
DROP POLICY IF EXISTS "we_own" ON public.workout_exercises;

-- 4. Secure handle_new_user (it's DEFINER, but let's ensure it's tight)
-- (Already DEFINER, but ensure search_path is set to public)
ALTER FUNCTION public.handle_new_user() SET search_path = public;

-- 5. AWARD group points: Ensure security definer and search path
ALTER FUNCTION public.award_group_points_on_session() SECURITY DEFINER SET search_path = public;

-- 6. Direct message push: Ensure search path
ALTER FUNCTION public.enqueue_push_direct_message() SECURITY DEFINER SET search_path = public;
ALTER FUNCTION public.enqueue_push_group_message() SECURITY DEFINER SET search_path = public;

-- 7. Grant access to public tables that might be missing explicit grants for service_role
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO service_role;

-- 8. Explicitly enable RLS on any table that might have missed it (defense in depth)
ALTER TABLE IF EXISTS public.daily_checkins ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.group_join_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.group_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.group_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.push_outbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.rest_push_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.session_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.sleep_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.strava_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.trainer_students ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.workout_exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.workout_reminder_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.workouts ENABLE ROW LEVEL SECURITY;
