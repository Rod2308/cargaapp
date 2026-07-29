CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA public;
CREATE INDEX IF NOT EXISTS exercises_name_trgm_idx ON public.exercises USING gin (name public.gin_trgm_ops);