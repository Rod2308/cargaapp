## Objetivo

Permitir escolher no cadastro se a pessoa é **aluno** ou **professor/treinador**. Professores ganham uma área para montar treinos e enviar direto para o perfil de um aluno.

## Fluxo

1. **Cadastro (`/auth`)** — novo campo "Sou..." com duas opções: *Aluno* / *Professor(a) / Treinador(a)*. A escolha é salva no perfil.
2. **Aluno** — app igual ao de hoje. Ganha um código de convite curto (ex: `CRG-7F3A`) visível no perfil, para compartilhar com o professor.
3. **Professor** — nova aba no menu: **Alunos**.
   - Adicionar aluno pelo código de convite.
   - Lista de alunos vinculados.
   - Abrir um aluno → ver treinos dele + botão **"Montar treino para este aluno"** (manual ou via IA, reaproveita o gerador atual, mas grava no `user_id` do aluno).
   - Treinos criados pelo professor aparecem no app do aluno normalmente, com uma marca "enviado pelo Prof. Fulano".

## Segurança

- Papéis ficam em tabela separada `user_roles` (enum `app_role`: `student`, `trainer`) + função `has_role` — nunca no `profiles`, para evitar escalonamento de privilégio.
- Vínculo aluno↔professor em `trainer_students` com aprovação implícita: o aluno gera o código, o professor usa o código → cria o vínculo. Aluno pode remover o vínculo a qualquer momento.
- RLS: professor só lê/escreve dados de alunos vinculados a ele. Aluno sempre lê os próprios dados.

## Mudanças no banco (uma migração)

- `app_role` enum: `student`, `trainer`.
- `user_roles(user_id, role)` + policies + `has_role()` security-definer.
- `profiles.invite_code text unique` (gerado no signup via trigger, curto e legível).
- `trainer_students(trainer_id, student_id, created_at)` com policies.
- `workouts.created_by_trainer_id uuid null` — quando preenchido, indica que foi enviado por um professor.
- Ajustar policies de `workouts` e `workout_exercises` para permitir que o professor vinculado leia/escreva treinos do aluno.
- Ajustar `handle_new_user()` para ler `raw_user_meta_data->>'role'` e inserir em `user_roles` + gerar `invite_code`.

## Mudanças no app

- `/auth` — seletor de papel no cadastro; passa `role` em `options.data`.
- `src/routes/_authenticated/app.tsx` — mostrar aba **Alunos** só para professor.
- `src/routes/_authenticated/app.perfil.tsx` — mostrar código de convite (para aluno) ou lista rápida de alunos (para professor).
- `src/routes/_authenticated/app.alunos.index.tsx` (novo) — lista + adicionar por código.
- `src/routes/_authenticated/app.alunos.$id.tsx` (novo) — treinos do aluno + botões Novo/IA (reaproveita `AiPlanDialog` e o gerador `generatePlan` com um parâmetro `for_user_id`).
- `src/lib/coach.functions.ts` — aceitar `for_user_id` opcional; se preenchido, valida vínculo pelo `has_role('trainer')` + `trainer_students` e grava no aluno.
- `src/lib/trainer.functions.ts` (novo) — `linkStudentByCode`, `listStudents`, `getStudent`, `unlinkStudent`.
- Hook `useRole()` — lê papel uma vez e disponibiliza no contexto autenticado.

## Confirmação antes de começar

- Ok fazer a migração do banco descrita acima?
- Um aluno pode ter **um só** professor por vez, ou **vários**? (Padrão sugerido: **um só**, mais simples.)
