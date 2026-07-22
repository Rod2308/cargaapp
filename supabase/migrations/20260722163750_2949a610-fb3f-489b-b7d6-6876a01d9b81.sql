
CREATE TABLE public.rest_push_schedules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  fire_at TIMESTAMPTZ NOT NULL,
  title TEXT NOT NULL DEFAULT 'Descanso concluído',
  body TEXT NOT NULL DEFAULT 'Hora de voltar para a próxima série!',
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rest_push_schedules TO authenticated;
GRANT ALL ON public.rest_push_schedules TO service_role;
ALTER TABLE public.rest_push_schedules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own rest schedules" ON public.rest_push_schedules
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX rest_push_schedules_due_idx ON public.rest_push_schedules (fire_at) WHERE sent_at IS NULL;
