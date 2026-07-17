
ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS elevation_gain_m int,
  ADD COLUMN IF NOT EXISTS elevation_loss_m int,
  ADD COLUMN IF NOT EXISTS route_geojson jsonb,
  ADD COLUMN IF NOT EXISTS import_source text;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS units_distance text NOT NULL DEFAULT 'km',
  ADD COLUMN IF NOT EXISTS units_weight   text NOT NULL DEFAULT 'kg';

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_units_distance_check,
  DROP CONSTRAINT IF EXISTS profiles_units_weight_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_units_distance_check CHECK (units_distance IN ('km','mi')),
  ADD CONSTRAINT profiles_units_weight_check   CHECK (units_weight IN ('kg','lb'));
