// Compute a friendly title/subtitle for a session row.
// Sessions can be:
//  - Structured workouts (session.workouts present) → "Treino A — Peito"
//  - Sport / free logs (no workout, but has session_sets with an exercise)
//    → exercise name, e.g. "Futebol"
//  - Otherwise → "Treino livre"

type MaybeWorkout = { name?: string | null; label?: string | null } | null | undefined;
type MaybeExercise = { name?: string | null; muscle_group?: string | null } | null | undefined;
type MaybeSet = { reps?: number | null; weight_kg?: number | null; exercises?: MaybeExercise } | null;

export interface SessionLike {
  notes?: string | null;
  workouts?: MaybeWorkout;
  session_sets?: MaybeSet[] | null;
}

function firstExercise(s: SessionLike): MaybeExercise {
  const sets = s.session_sets ?? [];
  for (const set of sets) {
    if (set?.exercises?.name) return set.exercises;
  }
  return null;
}

export function sessionTitle(s: SessionLike): string {
  if (s.workouts?.name) {
    const label = s.workouts.label ? `Treino ${s.workouts.label} — ` : "";
    return `${label}${s.workouts.name}`;
  }
  const ex = firstExercise(s);
  if (ex?.name) {
    if (ex.muscle_group === "Esportes") return ex.name;
    return ex.name;
  }
  return "Treino livre";
}

export function sessionSubtitle(s: SessionLike): string | null {
  // For sport sessions we stored `reps` = minutes; surface as duration.
  if (!s.workouts) {
    const ex = firstExercise(s);
    if (ex?.muscle_group === "Esportes") {
      const sets = s.session_sets ?? [];
      const minutes = sets.reduce((acc, set) => acc + (set?.reps ?? 0), 0);
      if (minutes > 0) return `${minutes} min`;
    }
  }
  const setsCount = s.session_sets?.length ?? 0;
  if (setsCount > 0 && s.workouts) return `${setsCount} série${setsCount === 1 ? "" : "s"}`;
  return null;
}
