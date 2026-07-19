
-- Groups
CREATE TABLE public.groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  emoji text DEFAULT '🏆',
  invite_code text NOT NULL UNIQUE,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  points_per_checkin integer NOT NULL DEFAULT 10,
  streak_bonus_enabled boolean NOT NULL DEFAULT true,
  streak_bonus_points integer NOT NULL DEFAULT 5,
  streak_bonus_every_days integer NOT NULL DEFAULT 3,
  created_at timestamptz NOT NULL DEFAULT now(),
  archived_at timestamptz
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.groups TO authenticated;
GRANT ALL ON public.groups TO service_role;
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.group_members (
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  joined_at timestamptz NOT NULL DEFAULT now(),
  current_streak integer NOT NULL DEFAULT 0,
  longest_streak integer NOT NULL DEFAULT 0,
  last_checkin_date date,
  PRIMARY KEY (group_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.group_members TO authenticated;
GRANT ALL ON public.group_members TO service_role;
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.group_points (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id uuid REFERENCES public.sessions(id) ON DELETE SET NULL,
  points integer NOT NULL,
  reason text NOT NULL,
  checkin_date date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (group_id, user_id, checkin_date, reason)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.group_points TO authenticated;
GRANT ALL ON public.group_points TO service_role;
ALTER TABLE public.group_points ENABLE ROW LEVEL SECURITY;

CREATE INDEX group_points_group_user_date_idx ON public.group_points(group_id, user_id, checkin_date DESC);
CREATE INDEX group_members_user_idx ON public.group_members(user_id);

-- Security definer helpers
CREATE OR REPLACE FUNCTION public.is_group_member(_group_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.group_members WHERE group_id = _group_id AND user_id = _user_id)
$$;

CREATE OR REPLACE FUNCTION public.is_group_owner(_group_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.groups WHERE id = _group_id AND owner_id = _user_id)
$$;

-- RPCs
CREATE OR REPLACE FUNCTION public.create_group(_name text, _description text DEFAULT NULL, _emoji text DEFAULT '🏆')
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
GRANT EXECUTE ON FUNCTION public.create_group(text, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.join_group_by_code(_code text)
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
GRANT EXECUTE ON FUNCTION public.join_group_by_code(text) TO authenticated;

-- Trigger to award points on session insert
CREATE OR REPLACE FUNCTION public.award_group_points_on_session()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  g record;
  checkin_day date;
  new_streak integer;
BEGIN
  checkin_day := (NEW.started_at AT TIME ZONE 'America/Sao_Paulo')::date;
  FOR g IN
    SELECT gr.id AS group_id, gr.points_per_checkin, gr.streak_bonus_enabled,
           gr.streak_bonus_points, gr.streak_bonus_every_days,
           gm.last_checkin_date, gm.current_streak, gm.longest_streak
    FROM public.group_members gm
    JOIN public.groups gr ON gr.id = gm.group_id
    WHERE gm.user_id = NEW.user_id AND gr.archived_at IS NULL
  LOOP
    INSERT INTO public.group_points (group_id, user_id, session_id, points, reason, checkin_date)
    VALUES (g.group_id, NEW.user_id, NEW.id, g.points_per_checkin, 'checkin', checkin_day)
    ON CONFLICT (group_id, user_id, checkin_date, reason) DO NOTHING;

    IF g.last_checkin_date IS DISTINCT FROM checkin_day THEN
      IF g.last_checkin_date = checkin_day - INTERVAL '1 day' THEN
        new_streak := g.current_streak + 1;
      ELSE
        new_streak := 1;
      END IF;
      UPDATE public.group_members
      SET last_checkin_date = checkin_day,
          current_streak = new_streak,
          longest_streak = GREATEST(g.longest_streak, new_streak)
      WHERE group_id = g.group_id AND user_id = NEW.user_id;

      IF g.streak_bonus_enabled AND new_streak > 0 AND new_streak % g.streak_bonus_every_days = 0 THEN
        INSERT INTO public.group_points (group_id, user_id, session_id, points, reason, checkin_date)
        VALUES (g.group_id, NEW.user_id, NEW.id, g.streak_bonus_points, 'streak_bonus', checkin_day)
        ON CONFLICT (group_id, user_id, checkin_date, reason) DO NOTHING;
      END IF;
    END IF;
  END LOOP;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_award_group_points
AFTER INSERT ON public.sessions
FOR EACH ROW EXECUTE FUNCTION public.award_group_points_on_session();

-- RLS policies
-- groups: members see, owner updates/deletes; no direct INSERT (use create_group RPC)
CREATE POLICY "members see group" ON public.groups FOR SELECT TO authenticated
  USING (public.is_group_member(id, auth.uid()));
CREATE POLICY "owner updates group" ON public.groups FOR UPDATE TO authenticated
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE POLICY "owner deletes group" ON public.groups FOR DELETE TO authenticated
  USING (owner_id = auth.uid());

-- group_members: members see roster; user removes self; no INSERT policy (use join RPC)
CREATE POLICY "members see roster" ON public.group_members FOR SELECT TO authenticated
  USING (public.is_group_member(group_id, auth.uid()));
CREATE POLICY "user leaves group" ON public.group_members FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.is_group_owner(group_id, auth.uid()));

-- group_points: members see; no write policies (trigger runs as security definer)
CREATE POLICY "members see points" ON public.group_points FOR SELECT TO authenticated
  USING (public.is_group_member(group_id, auth.uid()));
