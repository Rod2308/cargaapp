import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

// ------- Lista alunos vinculados ao professor atual -------
export const listStudents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: isTrainer } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "trainer",
    });
    if (!isTrainer) throw new Error("Apenas professores acessam esta área.");

    const { data: links, error } = await supabase
      .from("trainer_students")
      .select("student_id, created_at")
      .eq("trainer_id", userId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    const ids = (links ?? []).map((l) => l.student_id);
    if (ids.length === 0) return { students: [] as Array<{ id: string; display_name: string | null; created_at: string }> };

    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, display_name")
      .in("id", ids);

    const byId = new Map((profiles ?? []).map((p) => [p.id, p]));
    return {
      students: (links ?? []).map((l) => ({
        id: l.student_id,
        display_name: byId.get(l.student_id)?.display_name ?? null,
        created_at: l.created_at,
      })),
    };
  });

// ------- Vincula aluno pelo código de convite -------
const LinkInput = z.object({ invite_code: z.string().trim().min(4).max(20) });

export const linkStudentByCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => LinkInput.parse(v))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: isTrainer } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "trainer",
    });
    if (!isTrainer) throw new Error("Apenas professores podem vincular alunos.");

    const code = data.invite_code.toUpperCase();

    // Precisamos ler o profiles pelo código — usa admin (RLS restringe SELECT a professor vinculado)
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: student } = await supabaseAdmin
      .from("profiles")
      .select("id, display_name")
      .eq("invite_code", code)
      .maybeSingle();
    if (!student) throw new Error("Código não encontrado.");
    if (student.id === userId) throw new Error("Você não pode se vincular a si mesmo.");

    const { error } = await supabase
      .from("trainer_students")
      .insert({ trainer_id: userId, student_id: student.id });
    if (error) {
      if (error.code === "23505") throw new Error("Este aluno já tem um professor vinculado.");
      throw error;
    }
    return { student: { id: student.id, display_name: student.display_name } };
  });

// ------- Remove vínculo -------
const UnlinkInput = z.object({ student_id: z.string().uuid() });

export const unlinkStudent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => UnlinkInput.parse(v))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("trainer_students")
      .delete()
      .eq("trainer_id", userId)
      .eq("student_id", data.student_id);
    if (error) throw error;
    return { ok: true };
  });

// ------- Detalhes de um aluno (perfil + treinos) -------
const StudentInput = z.object({ student_id: z.string().uuid() });

export const getStudentDetails = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => StudentInput.parse(v))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: linked } = await supabase.rpc("is_trainer_of", {
      _trainer: userId,
      _student: data.student_id,
    });
    if (!linked) throw new Error("Aluno não vinculado a você.");

    const { data: profile } = await supabase
      .from("profiles")
      .select("id, display_name, goal, experience_level, weekly_frequency, injuries")
      .eq("id", data.student_id)
      .maybeSingle();

    const { data: workouts } = await supabase
      .from("workouts")
      .select("id, label, name, notes, created_by_trainer_id, order_idx")
      .eq("user_id", data.student_id)
      .order("order_idx");

    return { profile, workouts: workouts ?? [] };
  });
