DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ai_provider') THEN
    CREATE TYPE public.ai_provider AS ENUM ('openai', 'anthropic', 'google');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.user_ai_configs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    provider public.ai_provider NOT NULL,
    api_key text NOT NULL,
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL,
    UNIQUE (user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_ai_configs TO authenticated;
GRANT ALL ON public.user_ai_configs TO service_role;

ALTER TABLE public.user_ai_configs ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Users can manage their own AI config' AND polrelid = 'public.user_ai_configs'::regclass) THEN
    CREATE POLICY "Users can manage their own AI config"
    ON public.user_ai_configs
    FOR ALL
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;
