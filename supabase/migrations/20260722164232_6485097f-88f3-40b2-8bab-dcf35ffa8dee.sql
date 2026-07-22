
-- Prevent duplicate pending reminders per user+tag
CREATE UNIQUE INDEX IF NOT EXISTS push_outbox_user_tag_pending_uidx
  ON public.push_outbox (user_id, tag)
  WHERE sent_at IS NULL AND tag IS NOT NULL;
