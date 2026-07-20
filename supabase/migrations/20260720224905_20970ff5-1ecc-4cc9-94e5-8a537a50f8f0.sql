CREATE OR REPLACE FUNCTION public.get_group_public_invite(_code text)
RETURNS TABLE (
  name text,
  description text,
  emoji text,
  member_count bigint,
  is_archived boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT g.name,
         g.description,
         g.emoji,
         (SELECT COUNT(*) FROM public.group_members m WHERE m.group_id = g.id),
         g.archived_at IS NOT NULL
  FROM public.groups g
  WHERE g.invite_code = upper(trim(_code))
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_group_public_invite(text) FROM public;
GRANT EXECUTE ON FUNCTION public.get_group_public_invite(text) TO anon, authenticated;