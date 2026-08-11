-- Adiciona coluna para lembretes reprogramáveis
ALTER TABLE public.workout_reminder_settings 
ADD COLUMN IF NOT EXISTS reschedule_enabled boolean DEFAULT false;

-- Tabela para log de notificações enviadas (ajustando se já existir ou criando)
CREATE TABLE IF NOT EXISTS public.notification_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    type text NOT NULL, -- 'push' ou 'email'
    status text NOT NULL, -- 'sent', 'failed'
    error_message text,
    created_at timestamptz DEFAULT now()
);

GRANT SELECT, INSERT ON public.notification_logs TO authenticated;
GRANT ALL ON public.notification_logs TO service_role;

ALTER TABLE public.notification_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own notification logs"
ON public.notification_logs FOR SELECT
TO authenticated
USING (auth.uid() = user_id);
