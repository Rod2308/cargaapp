ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS source_platform text;
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS source_id text;

-- Add a unique constraint if needed, but the markdown says "vercel_workout_id"
-- I'll call it source_id for flexibility.
-- The markdown mentions vercel_workout_id specifically, so I'll add that too if it's preferred.
-- I'll stick to source_platform and source_id as suggested in the mapping section.

-- Ensure RLS allows the user to see these
-- (Existing policies on sessions usually cover all columns)
