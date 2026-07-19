
-- Trigger/internal-only SECURITY DEFINER functions: revoke EXECUTE from public, anon, authenticated.
-- Triggers still fire because Postgres trigger execution does not require EXECUTE on the function.
REVOKE EXECUTE ON FUNCTION public.generate_invite_code() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.prevent_workout_exercise_reassignment() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_cycle_tracking_sex() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.award_group_points_on_session() FROM PUBLIC, anon, authenticated;

-- RLS helper functions: only signed-in users need to evaluate them via policies.
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_trainer_of(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_group_owner(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_group_member(uuid, uuid) FROM PUBLIC, anon;

-- RPCs meant for signed-in users only: revoke anon access.
REVOKE EXECUTE ON FUNCTION public.create_group(text, text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.join_group_by_code(text) FROM PUBLIC, anon;
