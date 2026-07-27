-- groups: only create groups you own
CREATE POLICY "owner creates group"
ON public.groups FOR INSERT TO authenticated
WITH CHECK (owner_id = auth.uid());

-- group_join_requests: only request on your own behalf
CREATE POLICY "requester creates own request"
ON public.group_join_requests FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

-- group_members: only add yourself, and only when allowed
CREATE POLICY "user joins allowed group"
ON public.group_members FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND (
    EXISTS (
      SELECT 1 FROM public.groups g
      WHERE g.id = group_members.group_id
        AND g.archived_at IS NULL
        AND (g.owner_id = auth.uid() OR g.join_mode = 'open')
    )
    OR EXISTS (
      SELECT 1 FROM public.group_join_requests r
      WHERE r.group_id = group_members.group_id
        AND r.user_id = auth.uid()
        AND r.status = 'approved'
    )
  )
);

-- strava_connections: owner-scoped access only (tokens remain server-managed)
CREATE POLICY "own strava connection select"
ON public.strava_connections FOR SELECT TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "own strava connection insert"
ON public.strava_connections FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "own strava connection update"
ON public.strava_connections FOR UPDATE TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "own strava connection delete"
ON public.strava_connections FOR DELETE TO authenticated
USING (user_id = auth.uid());

GRANT ALL ON public.strava_connections TO service_role;