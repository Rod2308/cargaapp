
CREATE SCHEMA IF NOT EXISTS private;
GRANT USAGE ON SCHEMA private TO authenticated, service_role;

CREATE OR REPLACE FUNCTION private.is_group_member(_group_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.group_members WHERE group_id = _group_id AND user_id = _user_id)
$$;

CREATE OR REPLACE FUNCTION private.is_group_owner(_group_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.groups WHERE id = _group_id AND owner_id = _user_id)
$$;

CREATE OR REPLACE FUNCTION private.create_group(_name text, _description text DEFAULT NULL, _emoji text DEFAULT '🏆')
RETURNS public.groups LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  new_group public.groups;
  new_code text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF _name IS NULL OR length(trim(_name)) = 0 THEN RAISE EXCEPTION 'nome obrigatório'; END IF;
  LOOP
    new_code := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.groups WHERE invite_code = new_code);
  END LOOP;
  INSERT INTO public.groups (name, description, emoji, invite_code, owner_id)
  VALUES (trim(_name), _description, COALESCE(NULLIF(_emoji, ''), '🏆'), new_code, auth.uid())
  RETURNING * INTO new_group;
  INSERT INTO public.group_members (group_id, user_id) VALUES (new_group.id, auth.uid());
  RETURN new_group;
END;
$$;

CREATE OR REPLACE FUNCTION private.join_group_by_code(_code text)
RETURNS public.groups LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE target_group public.groups;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  SELECT * INTO target_group FROM public.groups WHERE invite_code = upper(trim(_code)) AND archived_at IS NULL;
  IF target_group.id IS NULL THEN RAISE EXCEPTION 'Código inválido ou grupo não encontrado'; END IF;
  INSERT INTO public.group_members (group_id, user_id) VALUES (target_group.id, auth.uid())
  ON CONFLICT (group_id, user_id) DO NOTHING;
  RETURN target_group;
END;
$$;

REVOKE ALL ON FUNCTION private.is_group_member(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.is_group_owner(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.create_group(text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.join_group_by_code(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.is_group_member(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.is_group_owner(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.create_group(text, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.join_group_by_code(text) TO authenticated, service_role;

DROP POLICY IF EXISTS "members see roster" ON public.group_members;
DROP POLICY IF EXISTS "user leaves group" ON public.group_members;
DROP POLICY IF EXISTS "members see group" ON public.groups;
DROP POLICY IF EXISTS "members see points" ON public.group_points;

CREATE POLICY "members see roster" ON public.group_members
  FOR SELECT TO authenticated
  USING (private.is_group_member(group_id, auth.uid()));

CREATE POLICY "user leaves group" ON public.group_members
  FOR DELETE TO authenticated
  USING ((user_id = auth.uid()) OR private.is_group_owner(group_id, auth.uid()));

CREATE POLICY "members see group" ON public.groups
  FOR SELECT TO authenticated
  USING (private.is_group_member(id, auth.uid()));

CREATE POLICY "members see points" ON public.group_points
  FOR SELECT TO authenticated
  USING (private.is_group_member(group_id, auth.uid()));

DROP FUNCTION IF EXISTS public.is_group_member(uuid, uuid);
DROP FUNCTION IF EXISTS public.is_group_owner(uuid, uuid);
DROP FUNCTION IF EXISTS public.create_group(text, text, text);
DROP FUNCTION IF EXISTS public.join_group_by_code(text);

CREATE OR REPLACE FUNCTION public.create_group(_name text, _description text DEFAULT NULL, _emoji text DEFAULT '🏆')
RETURNS public.groups LANGUAGE sql SECURITY INVOKER SET search_path = public AS $$
  SELECT * FROM private.create_group(_name, _description, _emoji);
$$;

CREATE OR REPLACE FUNCTION public.join_group_by_code(_code text)
RETURNS public.groups LANGUAGE sql SECURITY INVOKER SET search_path = public AS $$
  SELECT * FROM private.join_group_by_code(_code);
$$;

REVOKE ALL ON FUNCTION public.create_group(text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.join_group_by_code(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_group(text, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.join_group_by_code(text) TO authenticated, service_role;
