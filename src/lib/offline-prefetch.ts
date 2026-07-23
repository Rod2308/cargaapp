import type { QueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Pre-carrega os dados essenciais para o app funcionar offline:
 * - lista de treinos do usuário
 * - exercícios de cada treino (com detalhes)
 * - catálogo global de exercícios
 * - perfil
 * - últimas sessões
 *
 * Roda em segundo plano quando o app está online. O react-query-persister
 * salva tudo no IndexedDB, então da próxima vez que o usuário abrir sem
 * internet, os treinos aparecem normalmente.
 */
export async function prefetchOfflineEssentials(qc: QueryClient, userId: string) {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return;
  try {
    await Promise.allSettled([
      qc.prefetchQuery({
        queryKey: ["profile", userId],
        queryFn: async () => {
          const { data } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
          return data;
        },
      }),
      qc.prefetchQuery({
        queryKey: ["exercises"],
        queryFn: async () => {
          const { data } = await supabase.from("exercises").select("*").order("muscle_group").order("name");
          return data ?? [];
        },
      }),
      qc.prefetchQuery({
        queryKey: ["recent-sessions", userId],
        queryFn: async () => {
          const { data } = await supabase
            .from("sessions")
            .select(
              "id, started_at, ended_at, notes, workout_id, title, source, activity_type, distance_m, workouts(name, label), session_sets(reps, weight_kg, exercises(name, muscle_group))",
            )
            .eq("user_id", userId)
            .order("started_at", { ascending: false })
            .limit(5);
          return data ?? [];
        },
      }),
    ]);

    // Treinos + exercícios de cada treino
    await qc.prefetchQuery({
      queryKey: ["workouts", userId],
      queryFn: async () => {
        const { data } = await supabase.from("workouts").select("*").eq("user_id", userId).order("order_idx");
        return data ?? [];
      },
    });
    const workouts = qc.getQueryData<Array<{ id: string }>>(["workouts", userId]) ?? [];
    await Promise.allSettled(
      workouts.map((w) =>
        qc.prefetchQuery({
          queryKey: ["workout", w.id],
          queryFn: async () => {
            const { data } = await supabase.from("workouts").select("*").eq("id", w.id).single();
            return data;
          },
        }),
      ),
    );
    await Promise.allSettled(
      workouts.map((w) =>
        qc.prefetchQuery({
          queryKey: ["workout-exercises", w.id],
          queryFn: async () => {
            const { data } = await supabase
              .from("workout_exercises")
              .select("*, exercises(*)")
              .eq("workout_id", w.id)
              .order("order_idx");
            return data ?? [];
          },
        }),
      ),
    );
  } catch {
    // silencioso — prefetch é best-effort
  }
}
