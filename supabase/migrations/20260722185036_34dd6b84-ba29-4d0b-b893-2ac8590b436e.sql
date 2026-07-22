REVOKE EXECUTE ON FUNCTION public.get_group_public_invite(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_group_public_invite(text) TO service_role;