
-- 1. Extra columns on groups: deadline + daily/weekly/monthly caps
ALTER TABLE public.groups
  ADD COLUMN IF NOT EXISTS ends_at timestamptz,
  ADD COLUMN IF NOT EXISTS daily_points_cap integer,
  ADD COLUMN IF NOT EXISTS weekly_points_cap integer,
  ADD COLUMN IF NOT EXISTS monthly_points_cap integer;

-- 2. Trigger: respect deadline + caps
CREATE OR REPLACE FUNCTION public.award_group_points_on_session()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  g record;
  checkin_day date;
  new_streak integer;
  day_sum int; week_sum int; month_sum int;
  points_to_add int;
  bonus int;
BEGIN
  checkin_day := (NEW.started_at AT TIME ZONE 'America/Sao_Paulo')::date;
  FOR g IN
    SELECT gr.id AS group_id, gr.points_per_checkin, gr.streak_bonus_enabled,
           gr.streak_bonus_points, gr.streak_bonus_every_days,
           gr.ends_at, gr.daily_points_cap, gr.weekly_points_cap, gr.monthly_points_cap,
           gm.last_checkin_date, gm.current_streak, gm.longest_streak
    FROM public.group_members gm
    JOIN public.groups gr ON gr.id = gm.group_id
    WHERE gm.user_id = NEW.user_id
      AND gr.archived_at IS NULL
      AND (gr.ends_at IS NULL OR now() < gr.ends_at)
  LOOP
    points_to_add := g.points_per_checkin;

    IF g.daily_points_cap IS NOT NULL THEN
      SELECT COALESCE(SUM(points),0) INTO day_sum FROM public.group_points
        WHERE group_id = g.group_id AND user_id = NEW.user_id AND checkin_date = checkin_day;
      points_to_add := LEAST(points_to_add, GREATEST(0, g.daily_points_cap - day_sum));
    END IF;
    IF points_to_add > 0 AND g.weekly_points_cap IS NOT NULL THEN
      SELECT COALESCE(SUM(points),0) INTO week_sum FROM public.group_points
        WHERE group_id = g.group_id AND user_id = NEW.user_id
          AND checkin_date >= date_trunc('week', checkin_day)::date;
      points_to_add := LEAST(points_to_add, GREATEST(0, g.weekly_points_cap - week_sum));
    END IF;
    IF points_to_add > 0 AND g.monthly_points_cap IS NOT NULL THEN
      SELECT COALESCE(SUM(points),0) INTO month_sum FROM public.group_points
        WHERE group_id = g.group_id AND user_id = NEW.user_id
          AND checkin_date >= date_trunc('month', checkin_day)::date;
      points_to_add := LEAST(points_to_add, GREATEST(0, g.monthly_points_cap - month_sum));
    END IF;

    IF points_to_add > 0 THEN
      INSERT INTO public.group_points (group_id, user_id, session_id, points, reason, checkin_date)
      VALUES (g.group_id, NEW.user_id, NEW.id, points_to_add, 'checkin', checkin_day)
      ON CONFLICT (group_id, user_id, checkin_date, reason) DO NOTHING;
    END IF;

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
        bonus := g.streak_bonus_points;
        IF g.daily_points_cap IS NOT NULL THEN
          SELECT COALESCE(SUM(points),0) INTO day_sum FROM public.group_points
            WHERE group_id = g.group_id AND user_id = NEW.user_id AND checkin_date = checkin_day;
          bonus := LEAST(bonus, GREATEST(0, g.daily_points_cap - day_sum));
        END IF;
        IF bonus > 0 THEN
          INSERT INTO public.group_points (group_id, user_id, session_id, points, reason, checkin_date)
          VALUES (g.group_id, NEW.user_id, NEW.id, bonus, 'streak_bonus', checkin_day)
          ON CONFLICT (group_id, user_id, checkin_date, reason) DO NOTHING;
        END IF;
      END IF;
    END IF;
  END LOOP;
  RETURN NEW;
END;
$$;

-- 3. Group chat table
CREATE TABLE IF NOT EXISTS public.group_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content text NOT NULL CHECK (length(content) BETWEEN 1 AND 1000),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS group_messages_group_created_idx
  ON public.group_messages(group_id, created_at DESC);

GRANT SELECT, INSERT, DELETE ON public.group_messages TO authenticated;
GRANT ALL ON public.group_messages TO service_role;

ALTER TABLE public.group_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members read group messages" ON public.group_messages
  FOR SELECT TO authenticated
  USING (private.is_group_member(group_id, auth.uid()));

CREATE POLICY "members send group messages" ON public.group_messages
  FOR INSERT TO authenticated
  WITH CHECK (private.is_group_member(group_id, auth.uid()) AND user_id = auth.uid());

CREATE POLICY "author or owner deletes group message" ON public.group_messages
  FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR private.is_group_owner(group_id, auth.uid()));

ALTER PUBLICATION supabase_realtime ADD TABLE public.group_messages;
