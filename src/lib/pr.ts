// Detecção de recorde pessoal (PR) por exercício — puro, sem dependências.
// Compara uma série com o histórico anterior do MESMO exercício.

export type PrSetRow = {
  weight_kg: number | null;
  reps: number | null;
  completed_at?: string | null;
};

export type PrKind = "weight" | "reps_at_weight" | "volume" | null;

export type PrCheck = {
  isPr: boolean;
  kind: PrKind;
  message: string;
  /** Melhor carga anterior (kg). */
  prevBestWeight: number;
  /** Melhores reps anteriores nessa mesma carga. */
  prevRepsAtWeight: number;
};

/** Melhor carga já registrada no histórico. */
export function bestWeight(history: PrSetRow[]): number {
  return history.reduce((m, s) => Math.max(m, s.weight_kg ?? 0), 0);
}

/** Melhores reps no histórico para uma carga específica (>= a carga informada). */
export function bestRepsAtWeight(history: PrSetRow[], weight: number): number {
  return history.reduce(
    (m, s) => ((s.weight_kg ?? 0) >= weight ? Math.max(m, s.reps ?? 0) : m),
    0,
  );
}

/**
 * Verifica se a série informada é recorde comparada ao histórico anterior.
 * Regras (nesta ordem):
 *  1. carga maior que qualquer carga anterior → PR de carga;
 *  2. mesma carga máxima com mais repetições   → PR de reps na carga;
 *  3. maior volume (carga × reps) em uma série → PR de volume.
 */
export function checkPr(
  set: PrSetRow,
  history: PrSetRow[],
): PrCheck {
  const weight = set.weight_kg ?? 0;
  const reps = set.reps ?? 0;
  const prevBestWeight = bestWeight(history);
  const prevRepsAtWeight = bestRepsAtWeight(history, weight);

  const none: PrCheck = {
    isPr: false,
    kind: null,
    message: "",
    prevBestWeight,
    prevRepsAtWeight,
  };

  if (weight <= 0 || reps <= 0) return none;
  // Sem histórico não existe "recorde" — é apenas o primeiro registro.
  if (!history.length) return none;

  if (weight > prevBestWeight) {
    return {
      ...none,
      isPr: true,
      kind: "weight",
      message: `Novo recorde de carga: ${fmt(weight)} kg (antes ${fmt(prevBestWeight)} kg)`,
    };
  }

  if (weight === prevBestWeight && reps > prevRepsAtWeight) {
    return {
      ...none,
      isPr: true,
      kind: "reps_at_weight",
      message: `Novo recorde: ${reps} reps com ${fmt(weight)} kg (antes ${prevRepsAtWeight})`,
    };
  }

  const prevBestVolume = history.reduce(
    (m, s) => Math.max(m, (s.weight_kg ?? 0) * (s.reps ?? 0)),
    0,
  );
  const volume = weight * reps;
  if (volume > prevBestVolume) {
    return {
      ...none,
      isPr: true,
      kind: "volume",
      message: `Novo recorde de volume na série: ${fmt(volume)} kg`,
    };
  }

  return none;
}

function fmt(n: number): string {
  return (Math.round(n * 10) / 10).toString().replace(".", ",");
}
