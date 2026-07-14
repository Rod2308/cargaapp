
-- 1) Backfill: desativar ciclo para todos os perfis não-femininos
UPDATE public.profiles
SET
  cycle_tracking_enabled = false,
  cycle_last_period_start = NULL,
  cycle_length_days = 28,
  cycle_period_length_days = 5
WHERE sex IS DISTINCT FROM 'feminino'
  AND (
    cycle_tracking_enabled = true
    OR cycle_last_period_start IS NOT NULL
  );

-- 2) Trigger de reforço: se sexo != feminino, força desativação
CREATE OR REPLACE FUNCTION public.enforce_cycle_tracking_sex()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.sex IS DISTINCT FROM 'feminino' THEN
    NEW.cycle_tracking_enabled := false;
    NEW.cycle_last_period_start := NULL;
    -- mantém defaults nos campos NOT NULL
    IF NEW.cycle_length_days IS NULL THEN
      NEW.cycle_length_days := 28;
    END IF;
    IF NEW.cycle_period_length_days IS NULL THEN
      NEW.cycle_period_length_days := 5;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_cycle_tracking_sex_trg ON public.profiles;
CREATE TRIGGER enforce_cycle_tracking_sex_trg
BEFORE INSERT OR UPDATE OF sex, cycle_tracking_enabled, cycle_last_period_start, cycle_length_days, cycle_period_length_days
ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.enforce_cycle_tracking_sex();
