
-- 1) Enum de papéis
CREATE TYPE public.app_role AS ENUM ('student', 'trainer');

-- 2) Tabela user_roles
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own roles"
ON public.user_roles FOR SELECT TO authenticated
USING (auth.uid() = user_id);

-- 3) has_role security-definer
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;

-- 4) invite_code em profiles
ALTER TABLE public.profiles ADD COLUMN invite_code text UNIQUE;

CREATE OR REPLACE FUNCTION public.generate_invite_code()
RETURNS text
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; -- sem 0/O/1/I
  code text;
  i int;
  exists_already boolean;
BEGIN
  LOOP
    code := 'CRG-';
    FOR i IN 1..4 LOOP
      code := code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    END LOOP;
    SELECT EXISTS(SELECT 1 FROM public.profiles WHERE invite_code = code) INTO exists_already;
    EXIT WHEN NOT exists_already;
  END LOOP;
  RETURN code;
END;
$$;

-- Preenche códigos para perfis existentes
UPDATE public.profiles SET invite_code = public.generate_invite_code() WHERE invite_code IS NULL;

-- 5) trainer_students
CREATE TABLE public.trainer_students (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trainer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (student_id) -- um aluno tem no máximo um professor
);

CREATE INDEX trainer_students_trainer_idx ON public.trainer_students(trainer_id);

GRANT SELECT, INSERT, DELETE ON public.trainer_students TO authenticated;
GRANT ALL ON public.trainer_students TO service_role;

ALTER TABLE public.trainer_students ENABLE ROW LEVEL SECURITY;

-- Professor vê seus alunos; aluno vê seu professor
CREATE POLICY "Trainer or student can view link"
ON public.trainer_students FOR SELECT TO authenticated
USING (auth.uid() = trainer_id OR auth.uid() = student_id);

-- Só professor cria vínculo (pelo código de convite), e apenas para si mesmo
CREATE POLICY "Trainer creates link for self"
ON public.trainer_students FOR INSERT TO authenticated
WITH CHECK (auth.uid() = trainer_id AND public.has_role(auth.uid(), 'trainer'));

-- Ambos podem remover o vínculo
CREATE POLICY "Trainer or student can delete link"
ON public.trainer_students FOR DELETE TO authenticated
USING (auth.uid() = trainer_id OR auth.uid() = student_id);

-- 6) helper: é professor do aluno?
CREATE OR REPLACE FUNCTION public.is_trainer_of(_trainer uuid, _student uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.trainer_students
    WHERE trainer_id = _trainer AND student_id = _student
  )
$$;

-- 7) workouts: marca de origem
ALTER TABLE public.workouts ADD COLUMN created_by_trainer_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- Ajusta policies de workouts p/ permitir professor vinculado
DROP POLICY IF EXISTS "Users can manage their own workouts" ON public.workouts;
DROP POLICY IF EXISTS "workouts_owner_all" ON public.workouts;

CREATE POLICY "Owner or linked trainer can select workouts"
ON public.workouts FOR SELECT TO authenticated
USING (auth.uid() = user_id OR public.is_trainer_of(auth.uid(), user_id));

CREATE POLICY "Owner or linked trainer can insert workouts"
ON public.workouts FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id OR public.is_trainer_of(auth.uid(), user_id));

CREATE POLICY "Owner or linked trainer can update workouts"
ON public.workouts FOR UPDATE TO authenticated
USING (auth.uid() = user_id OR public.is_trainer_of(auth.uid(), user_id))
WITH CHECK (auth.uid() = user_id OR public.is_trainer_of(auth.uid(), user_id));

CREATE POLICY "Owner or linked trainer can delete workouts"
ON public.workouts FOR DELETE TO authenticated
USING (auth.uid() = user_id OR public.is_trainer_of(auth.uid(), user_id));

-- 8) workout_exercises: policies equivalentes (via workout->user_id)
DROP POLICY IF EXISTS "Users can manage their own workout exercises" ON public.workout_exercises;
DROP POLICY IF EXISTS "workout_exercises_owner_all" ON public.workout_exercises;

CREATE POLICY "Owner or linked trainer can select workout_exercises"
ON public.workout_exercises FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.workouts w
  WHERE w.id = workout_exercises.workout_id
    AND (w.user_id = auth.uid() OR public.is_trainer_of(auth.uid(), w.user_id))
));

CREATE POLICY "Owner or linked trainer can insert workout_exercises"
ON public.workout_exercises FOR INSERT TO authenticated
WITH CHECK (EXISTS (
  SELECT 1 FROM public.workouts w
  WHERE w.id = workout_exercises.workout_id
    AND (w.user_id = auth.uid() OR public.is_trainer_of(auth.uid(), w.user_id))
));

CREATE POLICY "Owner or linked trainer can update workout_exercises"
ON public.workout_exercises FOR UPDATE TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.workouts w
  WHERE w.id = workout_exercises.workout_id
    AND (w.user_id = auth.uid() OR public.is_trainer_of(auth.uid(), w.user_id))
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.workouts w
  WHERE w.id = workout_exercises.workout_id
    AND (w.user_id = auth.uid() OR public.is_trainer_of(auth.uid(), w.user_id))
));

CREATE POLICY "Owner or linked trainer can delete workout_exercises"
ON public.workout_exercises FOR DELETE TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.workouts w
  WHERE w.id = workout_exercises.workout_id
    AND (w.user_id = auth.uid() OR public.is_trainer_of(auth.uid(), w.user_id))
));

-- 9) Também: professor precisa ler nome/perfil do aluno (display_name) para exibir
DROP POLICY IF EXISTS "Linked trainer can view student profile" ON public.profiles;
CREATE POLICY "Linked trainer can view student profile"
ON public.profiles FOR SELECT TO authenticated
USING (public.is_trainer_of(auth.uid(), id));

-- 10) handle_new_user: grava role + invite_code
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  chosen_role public.app_role;
BEGIN
  -- perfil
  INSERT INTO public.profiles (id, display_name, invite_code)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
    public.generate_invite_code()
  );

  -- papel: 'trainer' se veio no signup, senão 'student'
  chosen_role := CASE
    WHEN NEW.raw_user_meta_data->>'role' = 'trainer' THEN 'trainer'::public.app_role
    ELSE 'student'::public.app_role
  END;

  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, chosen_role)
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

-- 11) Garante o trigger em auth.users (idempotente)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 12) Backfill: quem já existe vira 'student'
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'student'::public.app_role FROM auth.users
ON CONFLICT DO NOTHING;
