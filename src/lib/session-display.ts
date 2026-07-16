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

// Atividades consideradas cardio (aeróbicas / esportes contínuos).
const CARDIO_ACTIVITY_KEYWORDS = [
  "corrida", "corrid", "run",
  "caminhada", "caminh", "walk", "hik", "trilha",
  "ciclism", "bike", "cycl", "pedal",
  "natacao", "natação", "swim",
  "futebol", "society", "fut ",
  "volei", "vôlei", "volley",
  "basquete", "basket",
  "tenis", "tênis", "tennis",
  "handebol", "handball",
  "boxe", "muay", "kickbox", "jiu",
  "crossfit", "hiit",
  "danca", "dança", "zumba",
  "remo", "row",
  "eliptico", "elíptico", "elliptical",
  "escalada", "climb",
  "patins", "skate",
  "surf",
];

const CARDIO_ACTIVITY_TYPES = new Set([
  "running", "run", "cycling", "biking", "bike", "walking", "walk",
  "hiking", "swimming", "swim", "rowing", "row", "elliptical", "cardio",
]);

function normalize(str: string): string {
  return str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

export function isCardioSession(s: SessionLike): boolean {
  // Atividades importadas com activity_type conhecido
  if (s.activity_type && CARDIO_ACTIVITY_TYPES.has(s.activity_type.toLowerCase())) return true;
  // Distância registrada = corrida/caminhada/pedal
  if ((s.distance_m ?? 0) > 0) return true;
  // Treino livre com exercício do grupo "Esportes"
  const ex = firstExercise(s);
  if (ex?.muscle_group === "Esportes") return true;
  // Nomes conhecidos no exercício ou no título/atividade
  const haystack = normalize(
    [ex?.name ?? "", s.title ?? "", s.activity_type ?? ""].join(" "),
  );
  if (haystack.trim() && CARDIO_ACTIVITY_KEYWORDS.some((k) => haystack.includes(k))) return true;
  return false;
}

export function sessionTitle(s: SessionLike): string {
  if (s.title && s.title.trim()) return s.title.trim();
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
