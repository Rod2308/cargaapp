import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// ------- Lista alunos vinculados ao professor atual -------
export const listStudents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { listStudentsAction } = await import("./bridge-actions.server");
    return listStudentsAction(context.supabase, context.userId);
  });

// ------- Vincula aluno pelo código de convite -------
export const linkStudentByCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => v)
  .handler(async ({ data, context }) => {
    const { linkStudentByCodeAction } = await import("./bridge-actions.server");
    return linkStudentByCodeAction(context.supabase, context.userId, data);
  });

// ------- Remove vínculo -------
export const unlinkStudent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => v)
  .handler(async ({ data, context }) => {
    const { unlinkStudentAction } = await import("./bridge-actions.server");
    return unlinkStudentAction(context.supabase, context.userId, data);
  });

// ------- Detalhes de um aluno (perfil + treinos) -------
export const getStudentDetails = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => v)
  .handler(async ({ data, context }) => {
    const { getStudentDetailsAction } = await import("./bridge-actions.server");
    return getStudentDetailsAction(context.supabase, context.userId, data);
  });

// ------- (Aluno) busca o professor vinculado -------
export const getMyTrainer = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { getMyTrainerAction } = await import("./bridge-actions.server");
    return getMyTrainerAction(context.supabase, context.userId);
  });

// ------- (Aluno) vincula-se a um professor pelo código -------
export const linkTrainerByCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => v)
  .handler(async ({ data, context }) => {
    const { linkTrainerByCodeAction } = await import("./bridge-actions.server");
    return linkTrainerByCodeAction(context.supabase, context.userId, data);
  });

// ------- (Aluno) remove o próprio vínculo -------
export const unlinkMyTrainer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { unlinkMyTrainerAction } = await import("./bridge-actions.server");
    return unlinkMyTrainerAction(context.supabase, context.userId);
  });
