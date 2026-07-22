
CREATE TABLE public.push_outbox (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  url TEXT,
  tag TEXT,
  fire_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.push_outbox TO authenticated;
GRANT ALL ON public.push_outbox TO service_role;
ALTER TABLE public.push_outbox ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own outbox read" ON public.push_outbox FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE INDEX push_outbox_due_idx ON public.push_outbox (fire_at) WHERE sent_at IS NULL;

-- Enfileira push para mensagem direta
CREATE OR REPLACE FUNCTION public.enqueue_push_direct_message()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  sender_name TEXT;
BEGIN
  IF NEW.receiver_id IS NULL OR NEW.receiver_id = NEW.sender_id THEN RETURN NEW; END IF;
  SELECT COALESCE(display_name, 'Nova mensagem') INTO sender_name FROM public.profiles WHERE id = NEW.sender_id;
  INSERT INTO public.push_outbox (user_id, title, body, url, tag)
  VALUES (
    NEW.receiver_id,
    COALESCE(sender_name, 'Nova mensagem'),
    LEFT(COALESCE(NEW.content, ''), 140),
    '/app/mensagens',
    'msg:' || NEW.sender_id::text
  );
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_enqueue_push_direct_message
AFTER INSERT ON public.messages
FOR EACH ROW EXECUTE FUNCTION public.enqueue_push_direct_message();

-- Enfileira push para mensagem de grupo (para todos os membros exceto o autor)
CREATE OR REPLACE FUNCTION public.enqueue_push_group_message()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  sender_name TEXT;
  group_name TEXT;
BEGIN
  SELECT COALESCE(display_name, 'Membro') INTO sender_name FROM public.profiles WHERE id = NEW.user_id;
  SELECT COALESCE(name, 'Grupo') INTO group_name FROM public.groups WHERE id = NEW.group_id;
  INSERT INTO public.push_outbox (user_id, title, body, url, tag)
  SELECT gm.user_id,
         group_name,
         sender_name || ': ' || LEFT(COALESCE(NEW.content, ''), 120),
         '/app/grupos/' || NEW.group_id::text,
         'group:' || NEW.group_id::text
  FROM public.group_members gm
  WHERE gm.group_id = NEW.group_id AND gm.user_id <> NEW.user_id;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_enqueue_push_group_message
AFTER INSERT ON public.group_messages
FOR EACH ROW EXECUTE FUNCTION public.enqueue_push_group_message();

REVOKE EXECUTE ON FUNCTION public.enqueue_push_direct_message() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enqueue_push_group_message() FROM PUBLIC, anon, authenticated;
