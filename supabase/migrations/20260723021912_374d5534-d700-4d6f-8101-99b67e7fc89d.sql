
-- 1) Tabela que guarda a conexão Strava de cada usuário
CREATE TABLE IF NOT EXISTS public.strava_connections (
  user_id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  strava_athlete_id  BIGINT NOT NULL,
  access_token       TEXT   NOT NULL,
  refresh_token      TEXT   NOT NULL,
  expires_at         TIMESTAMPTZ NOT NULL,
  scope              TEXT,
  last_sync_at       TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (strava_athlete_id)
);

-- Somente service_role acessa (contém tokens). Usuário lê status via server fn.
GRANT ALL ON public.strava_connections TO service_role;
ALTER TABLE public.strava_connections ENABLE ROW LEVEL SECURITY;
-- Sem policies para authenticated/anon: apenas server-side com service_role pode ler/escrever.

CREATE TRIGGER strava_connections_set_updated_at
BEFORE UPDATE ON public.strava_connections
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2) Coluna para deduplicar atividades importadas do Strava
ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS strava_activity_id BIGINT;

CREATE UNIQUE INDEX IF NOT EXISTS sessions_user_strava_activity_uk
  ON public.sessions(user_id, strava_activity_id)
  WHERE strava_activity_id IS NOT NULL;
