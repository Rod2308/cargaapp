
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE OR REPLACE FUNCTION public.is_trainer_of(_trainer uuid, _student uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.trainer_students
    WHERE trainer_id = _trainer AND student_id = _student
  )
$$;
