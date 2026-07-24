
-- Backfill missing muscle_group / equipment / image_url for exercises that
-- appear in imported plans but are still shown as "Outros" or without image.
UPDATE public.exercises SET
  muscle_group = CASE lower(name)
    WHEN 'chest press' THEN 'Peito'
    WHEN 'crucifixo inverso' THEN 'Ombros'
    WHEN 'crucifixo máquina' THEN 'Peito'
    WHEN 'desenvolvimento máquina' THEN 'Ombros'
    WHEN 'elevação lateral unilateral' THEN 'Ombros'
    WHEN 'flexora unilateral' THEN 'Pernas'
    WHEN 'hip thrust' THEN 'Glúteos'
    WHEN 'panturrilha sentada' THEN 'Panturrilha'
    WHEN 'pullover' THEN 'Costas'
    WHEN 'puxada neutra' THEN 'Costas'
    WHEN 'remada unilateral' THEN 'Costas'
    WHEN 'rosca inclinada' THEN 'Bíceps'
    WHEN 'rosca scott' THEN 'Bíceps'
    WHEN 'terra romeno' THEN 'Pernas'
    WHEN 'tríceps testa' THEN 'Tríceps'
    ELSE muscle_group END,
  equipment = COALESCE(equipment, CASE lower(name)
    WHEN 'chest press' THEN 'Máquina'
    WHEN 'crucifixo inverso' THEN 'Máquina'
    WHEN 'crucifixo máquina' THEN 'Máquina'
    WHEN 'desenvolvimento máquina' THEN 'Máquina'
    WHEN 'elevação lateral unilateral' THEN 'Halteres'
    WHEN 'flexora unilateral' THEN 'Máquina'
    WHEN 'hip thrust' THEN 'Barra'
    WHEN 'panturrilha sentada' THEN 'Máquina'
    WHEN 'pullover' THEN 'Halteres'
    WHEN 'puxada neutra' THEN 'Polia'
    WHEN 'remada unilateral' THEN 'Halteres'
    WHEN 'rosca inclinada' THEN 'Halteres'
    WHEN 'rosca scott' THEN 'Barra'
    WHEN 'terra romeno' THEN 'Barra'
    WHEN 'tríceps testa' THEN 'Barra'
    WHEN 'bíceps alternado com halter' THEN 'Halteres'
    WHEN 'bíceps corda na polia' THEN 'Polia'
    WHEN 'tríceps barra na polia' THEN 'Polia'
    WHEN 'tríceps coice na polia' THEN 'Polia'
    WHEN 'tríceps francês na polia' THEN 'Polia'
    WHEN 'abdominal canivete' THEN 'Peso corporal'
    WHEN 'abdominal infra' THEN 'Peso corporal'
    WHEN 'abdominal oblíquo' THEN 'Peso corporal'
    WHEN 'abdominal remador' THEN 'Peso corporal'
    WHEN 'abdominal reto (crunch)' THEN 'Peso corporal'
    ELSE equipment END),
  image_url = COALESCE(image_url, CASE lower(name)
    WHEN 'chest press' THEN 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Machine_Bench_Press/0.jpg'
    WHEN 'crucifixo inverso' THEN 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Reverse_Machine_Flyes/0.jpg'
    WHEN 'crucifixo máquina' THEN 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Butterfly/0.jpg'
    WHEN 'desenvolvimento máquina' THEN 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Machine_Shoulder_(Military)_Press/0.jpg'
    WHEN 'elevação lateral unilateral' THEN 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/One-Arm_Side_Laterals/0.jpg'
    WHEN 'flexora unilateral' THEN 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Lying_One-Leg_Curl/0.jpg'
    WHEN 'hip thrust' THEN 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Barbell_Hip_Thrust/0.jpg'
    WHEN 'panturrilha sentada' THEN 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Seated_Calf_Raise/0.jpg'
    WHEN 'pullover' THEN 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Dumbbell_Pullover/0.jpg'
    WHEN 'puxada neutra' THEN 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Close-Grip_Front_Lat_Pulldown/0.jpg'
    WHEN 'remada unilateral' THEN 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/One-Arm_Dumbbell_Row/0.jpg'
    WHEN 'rosca inclinada' THEN 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Incline_Dumbbell_Curl/0.jpg'
    WHEN 'rosca scott' THEN 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Preacher_Curl/0.jpg'
    WHEN 'terra romeno' THEN 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Romanian_Deadlift/0.jpg'
    WHEN 'tríceps testa' THEN 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Lying_Triceps_Press/0.jpg'
    WHEN 'bíceps alternado com halter' THEN 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Alternate_Incline_Dumbbell_Curl/0.jpg'
    WHEN 'bíceps corda na polia' THEN 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Cable_Hammer_Curls_-_Rope_Attachment/0.jpg'
    WHEN 'tríceps barra na polia' THEN 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Triceps_Pushdown/0.jpg'
    WHEN 'tríceps coice na polia' THEN 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Tricep_Dumbbell_Kickback/0.jpg'
    WHEN 'tríceps francês na polia' THEN 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Cable_Incline_Triceps_Extension/0.jpg'
    WHEN 'abdominal canivete' THEN 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Jackknife_Sit-Up/0.jpg'
    WHEN 'abdominal infra' THEN 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Flat_Bench_Lying_Leg_Raise/0.jpg'
    WHEN 'abdominal oblíquo' THEN 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Oblique_Crunches/0.jpg'
    WHEN 'abdominal remador' THEN 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Cross-Body_Crunch/0.jpg'
    WHEN 'abdominal reto (crunch)' THEN 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Crunches/0.jpg'
    ELSE image_url END)
WHERE lower(name) IN (
  'chest press','crucifixo inverso','crucifixo máquina','desenvolvimento máquina',
  'elevação lateral unilateral','flexora unilateral','hip thrust','panturrilha sentada',
  'pullover','puxada neutra','remada unilateral','rosca inclinada','rosca scott',
  'terra romeno','tríceps testa','bíceps alternado com halter','bíceps corda na polia',
  'tríceps barra na polia','tríceps coice na polia','tríceps francês na polia',
  'abdominal canivete','abdominal infra','abdominal oblíquo','abdominal remador',
  'abdominal reto (crunch)'
);
