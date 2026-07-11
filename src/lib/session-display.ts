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
  title?: string | null;
  workouts?: MaybeWorkout;
  session_sets?: MaybeSet[] | null;
  activity_type?: string | null;
  source?: string | null;
  distance_m?: number | null;
  started_at?: string | null;
  ended_at?: string | null;
}


function firstExercise(s: SessionLike): MaybeExercise {
  const sets = s.session_sets ?? [];
  for (const set of sets) {
    if (set?.exercises?.name) return set.exercises;
  }
  return null;
}

const ACTIVITY_LABELS: Record<string, string> = {
  running: "Corrida",
  run: "Corrida",
  cycling: "Ciclismo",
  biking: "Ciclismo",
  bike: "Ciclismo",
  walking: "Caminhada",
  walk: "Caminhada",
  hiking: "Trilha",
  swimming: "Natação",
  swim: "Natação",
  training: "Treino",
  strength_training: "Musculação",
  strength: "Musculação",
  other: "Atividade",
};

function isImported(s: SessionLike): boolean {
  return !!s.source && s.source !== "manual";
}

export function sessionTitle(s: SessionLike): string {
  if (s.workouts?.name) {
    const label = s.workouts.label ? `Treino ${s.workouts.label} — ` : "";
    return `${label}${s.workouts.name}`;
  }
  if (isImported(s) && s.activity_type) {
    return ACTIVITY_LABELS[s.activity_type.toLowerCase()] ?? s.activity_type;
  }
  const ex = firstExercise(s);
  if (ex?.name) return ex.name;
  if (isImported(s)) return "Atividade importada";
  return "Treino livre";
}

export function sessionSubtitle(s: SessionLike): string | null {
  if (isImported(s)) {
    const parts: string[] = [];
    if (s.distance_m && s.distance_m > 0) {
      parts.push(s.distance_m >= 1000 ? `${(s.distance_m / 1000).toFixed(2).replace(".", ",")} km` : `${s.distance_m} m`);
    }
    if (s.started_at && s.ended_at) {
      const secs = Math.max(0, Math.round((new Date(s.ended_at).getTime() - new Date(s.started_at).getTime()) / 1000));
      if (secs > 0) {
        const h = Math.floor(secs / 3600);
        const m = Math.floor((secs % 3600) / 60);
        parts.push(h > 0 ? `${h}h${String(m).padStart(2, "0")}` : `${m}min`);
      }
    }
    return parts.length ? parts.join(" · ") : null;
  }
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
