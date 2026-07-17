DROP POLICY IF EXISTS "authenticated can use realtime" ON realtime.messages;

CREATE POLICY "Users can subscribe to own DM channels"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.messages m
    WHERE (m.sender_id = auth.uid() OR m.receiver_id = auth.uid())
  )
);