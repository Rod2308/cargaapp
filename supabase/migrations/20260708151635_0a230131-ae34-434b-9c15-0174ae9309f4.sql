
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS sex text CHECK (sex IN ('masculino','feminino','outro')),
  ADD COLUMN IF NOT EXISTS birth_date date,
  ADD COLUMN IF NOT EXISTS height_cm numeric(5,1),
  ADD COLUMN IF NOT EXISTS weight_kg numeric(5,1),
  ADD COLUMN IF NOT EXISTS activity_level text CHECK (activity_level IN ('sedentario','leve','moderado','ativo','muito_ativo')),
  ADD COLUMN IF NOT EXISTS injuries text;
