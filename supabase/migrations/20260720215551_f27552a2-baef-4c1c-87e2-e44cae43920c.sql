
-- 1. join_mode column
ALTER TABLE public.groups
  ADD COLUMN IF NOT EXISTS join_mode text NOT NULL DEFAULT 'open'
  CHECK (join_mode IN ('open','approval'));

-- 2. join requests table
CREATE TABLE IF NOT EXISTS public.group_join_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','declined','cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  decided_at timestamptz,
  decided_by uuid REFERENCES auth.users(id),
  UNIQUE (group_id, user_id, status)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.group_join_requests TO authenticated;
GRANT ALL ON public.group_join_requests TO service_role;

ALTER TABLE public.group_join_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "requester sees own requests"
  ON public.group_join_requests FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "owner sees group requests"
  ON public.group_join_requests FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.groups g WHERE g.id = group_id AND g.owner_id = auth.uid()));

CREATE POLICY "requester cancels own pending"
  ON public.group_join_requests FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- 3. RPC: request or join by code (returns jsonb)
CREATE OR REPLACE FUNCTION private.request_or_join_by_code(_code text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  g public.groups;
  already boolean;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  SELECT * INTO g FROM public.groups
    WHERE invite_code = upper(trim(_code)) AND archived_at IS NULL;
  IF g.id IS NULL THEN RAISE EXCEPTION 'Código inválido ou grupo não encontrado'; END IF;

  SELECT EXISTS(
    SELECT 1 FROM public.group_members WHERE group_id = g.id AND user_id = auth.uid()
  ) INTO already;
  IF already THEN
    RETURN jsonb_build_object('status','already_member','group_id',g.id,'name',g.name);
  END IF;

  IF g.join_mode = 'open' THEN
    INSERT INTO public.group_members (group_id, user_id) VALUES (g.id, auth.uid())
    ON CONFLICT DO NOTHING;
    RETURN jsonb_build_object('status','joined','group_id',g.id,'name',g.name);
  ELSE
    INSERT INTO public.group_join_requests (group_id, user_id, status)
    VALUES (g.id, auth.uid(), 'pending')
    ON CONFLICT (group_id, user_id, status) DO NOTHING;
    RETURN jsonb_build_object('status','pending','group_id',g.id,'name',g.name);
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.request_or_join_by_code(_code text)
RETURNS jsonb LANGUAGE sql SET search_path = public AS $$
  SELECT private.request_or_join_by_code(_code);
$$;

-- 4. Approve / decline
CREATE OR REPLACE FUNCTION private.decide_join_request(_id uuid, _approve boolean)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  r public.group_join_requests;
  is_owner boolean;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  SELECT * INTO r FROM public.group_join_requests WHERE id = _id;
  IF r.id IS NULL THEN RAISE EXCEPTION 'Pedido não encontrado'; END IF;
  IF r.status <> 'pending' THEN RAISE EXCEPTION 'Pedido já decidido'; END IF;
  SELECT (owner_id = auth.uid()) INTO is_owner FROM public.groups WHERE id = r.group_id;
  IF NOT COALESCE(is_owner,false) THEN RAISE EXCEPTION 'Apenas o dono do grupo pode decidir'; END IF;

  UPDATE public.group_join_requests
    SET status = CASE WHEN _approve THEN 'approved' ELSE 'declined' END,
        decided_at = now(),
        decided_by = auth.uid()
    WHERE id = _id;

  IF _approve THEN
    INSERT INTO public.group_members (group_id, user_id) VALUES (r.group_id, r.user_id)
    ON CONFLICT DO NOTHING;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.decide_join_request(_id uuid, _approve boolean)
RETURNS void LANGUAGE sql SET search_path = public AS $$
  SELECT private.decide_join_request(_id, _approve);
$$;

-- 5. Lock down function execute perms (public wrappers only for authenticated)
REVOKE ALL ON FUNCTION public.request_or_join_by_code(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_or_join_by_code(text) TO authenticated;
REVOKE ALL ON FUNCTION public.decide_join_request(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.decide_join_request(uuid, boolean) TO authenticated;
