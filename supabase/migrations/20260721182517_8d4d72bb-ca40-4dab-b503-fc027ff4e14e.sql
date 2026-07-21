
-- Revoke public EXECUTE on trigger-only SECURITY DEFINER functions.
-- These functions are invoked by row triggers on tables/auth.users and must
-- never be callable directly by clients.
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.award_group_points_on_session() FROM PUBLIC, anon, authenticated;

-- The public invite lookup is intentionally exposed for OG/link previews and
-- returns only safe columns; keep anon EXECUTE, revoke authenticated (they use
-- richer APIs) and PUBLIC (default catch-all).
REVOKE ALL ON FUNCTION public.get_group_public_invite(text) FROM PUBLIC, authenticated;
GRANT EXECUTE ON FUNCTION public.get_group_public_invite(text) TO anon;
