-- Idempotência para fila offline: cliente gera um UUID por mutação;
-- servidor rejeita duplicatas via UNIQUE, então retries são seguros.

ALTER TABLE public.sessions          ADD COLUMN IF NOT EXISTS client_mutation_id uuid;
ALTER TABLE public.session_sets      ADD COLUMN IF NOT EXISTS client_mutation_id uuid;
ALTER TABLE public.workouts          ADD COLUMN IF NOT EXISTS client_mutation_id uuid;
ALTER TABLE public.workout_exercises ADD COLUMN IF NOT EXISTS client_mutation_id uuid;
ALTER TABLE public.messages          ADD COLUMN IF NOT EXISTS client_mutation_id uuid;
ALTER TABLE public.group_messages    ADD COLUMN IF NOT EXISTS client_mutation_id uuid;
ALTER TABLE public.daily_checkins    ADD COLUMN IF NOT EXISTS client_mutation_id uuid;
ALTER TABLE public.sleep_logs        ADD COLUMN IF NOT EXISTS client_mutation_id uuid;

CREATE UNIQUE INDEX IF NOT EXISTS sessions_client_mutation_id_key          ON public.sessions          (client_mutation_id) WHERE client_mutation_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS session_sets_client_mutation_id_key      ON public.session_sets      (client_mutation_id) WHERE client_mutation_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS workouts_client_mutation_id_key          ON public.workouts          (client_mutation_id) WHERE client_mutation_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS workout_exercises_client_mutation_id_key ON public.workout_exercises (client_mutation_id) WHERE client_mutation_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS messages_client_mutation_id_key          ON public.messages          (client_mutation_id) WHERE client_mutation_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS group_messages_client_mutation_id_key    ON public.group_messages    (client_mutation_id) WHERE client_mutation_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS daily_checkins_client_mutation_id_key    ON public.daily_checkins    (client_mutation_id) WHERE client_mutation_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS sleep_logs_client_mutation_id_key        ON public.sleep_logs        (client_mutation_id) WHERE client_mutation_id IS NOT NULL;