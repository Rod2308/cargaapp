// ============================================================================
// Fonte única de verdade para recuperação muscular.
//
// Antes existiam duas implementações: `recovery-core.ts` (dias fracionados,
// limiares fixos 1.75d/2.5d iguais para todo grupo) e `daily-suggestion.ts`
// (dias de calendário inteiros, limiares por grupo). Este módulo unifica:
//   - limiares POR GRUPO (vindos do daily-suggestion — mais realistas)
//   - cálculo em DIAS FRACIONADOS (vindo do recovery-core — mais preciso)
// ============================================================================

export type MuscleGroup =
  | "peito"
  | "costas"
  | "pernas"
  | "ombro"
  | "biceps"
  | "triceps"
  | "gluteo"
  | "abdomen"
  | "antebraco";

/** Grupos que o motor de sugestão pode propor como foco de treino. */
export const MUSCLE_GROUPS: MuscleGroup[] = [
  "peito",
  "costas",
  "pernas",
  "ombro",
  "biceps",
  "triceps",
  "gluteo",
  "abdomen",
];

/** Todos os grupos reconhecidos (inclui os acessórios, ex.: antebraço). */
export const ALL_MUSCLE_GROUPS: MuscleGroup[] = [...MUSCLE_GROUPS, "antebraco"];

export const MUSCLE_LABEL: Record<MuscleGroup, string> = {
  peito: "Peito",
  costas: "Costas",
  pernas: "Pernas",
  ombro: "Ombro",
  biceps: "Bíceps",
  triceps: "Tríceps",
  gluteo: "Glúteo",
  abdomen: "Abdômen",
  antebraco: "Antebraço",
};

/** Dias necessários de descanso por grupo (limiar de recuperação). */
export const MUSCLE_RECOVERY_DAYS: Record<MuscleGroup, number> = {
  peito: 2,
  costas: 2,
  pernas: 3,
  ombro: 2,
  biceps: 2,
  triceps: 2,
  gluteo: 2,
  abdomen: 1,
  antebraco: 1.5,
};

const strip = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

/**
 * Normaliza um nome livre de grupo muscular vindo do banco
 * (`exercises.muscle_group`) para um `MuscleGroup` canônico.
 *
 * Trata "Panturrilha" e "Panturrilhas" (duplicidade histórica no banco)
 * como o mesmo grupo, e reconhece "Antebraço".
 */
export function normalizeMuscleGroup(raw: string | null | undefined): MuscleGroup | null {
  if (!raw) return null;
  const s = strip(raw);
  if (/antebrac|forearm/.test(s)) return "antebraco";
  if (/peito|peitoral|chest/.test(s)) return "peito";
  if (/costas|dorsal|back|latiss/.test(s)) return "costas";
  // "panturrilha" e "panturrilhas" caem aqui, no mesmo grupo de pernas
  if (/perna|quadr|posterior|panturr|calf|calves|leg|quads|hams/.test(s)) return "pernas";
  if (/ombro|delto|shoulder/.test(s)) return "ombro";
  if (/bicep/.test(s)) return "biceps";
  if (/tricep/.test(s)) return "triceps";
  if (/gluteo|gluteos|gluteus|butt/.test(s)) return "gluteo";
  if (/abdom|core|abs/.test(s)) return "abdomen";
  return null;
}

/** Rótulo canônico de exibição a partir de um nome livre do banco. */
export function canonicalMuscleLabel(raw: string | null | undefined): string | null {
  const g = normalizeMuscleGroup(raw);
  return g ? MUSCLE_LABEL[g] : null;
}

/** Diferença em dias fracionados entre `now` e uma data/ISO qualquer. */
export function fractionalDaysSince(when: string | Date, now: Date = new Date()): number {
  const t = when instanceof Date ? when.getTime() : new Date(when).getTime();
  if (!Number.isFinite(t)) return Number.POSITIVE_INFINITY;
  return (now.getTime() - t) / 86_400_000;
}

/** O grupo já cumpriu o descanso necessário? (dias fracionados) */
export function isMuscleRecovered(group: MuscleGroup, daysAgo: number): boolean {
  return daysAgo >= MUSCLE_RECOVERY_DAYS[group];
}

/** Fração de recuperação 0..1 do grupo (1 = totalmente recuperado). */
export function recoveryRatio(group: MuscleGroup, daysAgo: number): number {
  if (!Number.isFinite(daysAgo)) return 1;
  return Math.max(0, Math.min(1, daysAgo / MUSCLE_RECOVERY_DAYS[group]));
}
