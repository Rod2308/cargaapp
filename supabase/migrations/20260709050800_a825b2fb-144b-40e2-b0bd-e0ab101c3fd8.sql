
-- Add 'admin' to app_role enum so we can gate role writes to admins
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'admin';
