-- Remove policy pública ampla de SELECT em storage.objects.
-- Imagens continuam acessíveis por URL pública porque o bucket é public.
DROP POLICY IF EXISTS "Public read exercise images" ON storage.objects;

-- Substitui INSERT irrestrito por INSERT restrito a professores.
DROP POLICY IF EXISTS "Trainers can upload exercise images" ON storage.objects;
CREATE POLICY "Trainers can upload exercise images"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'exercise-images'
  AND public.has_role(auth.uid(), 'trainer'::public.app_role)
);

-- Restringe UPDATE/DELETE ao dono E ao papel de professor (defesa em profundidade)
DROP POLICY IF EXISTS "Trainers can update own exercise images" ON storage.objects;
CREATE POLICY "Trainers can update own exercise images"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'exercise-images'
  AND owner = auth.uid()
  AND public.has_role(auth.uid(), 'trainer'::public.app_role)
);

DROP POLICY IF EXISTS "Trainers can delete own exercise images" ON storage.objects;
CREATE POLICY "Trainers can delete own exercise images"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'exercise-images'
  AND owner = auth.uid()
  AND public.has_role(auth.uid(), 'trainer'::public.app_role)
);