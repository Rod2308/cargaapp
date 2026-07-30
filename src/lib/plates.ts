// Calculadora de anilhas — determinística, sem dependências.
// Dado um peso alvo e a barra, devolve as anilhas de CADA lado.

export const DEFAULT_PLATES = [25, 20, 15, 10, 5, 2.5, 2, 1.5, 1, 0.5];
export const DEFAULT_BAR_KG = 20;

export type PlateResult = {
  /** Anilhas por lado, da mais pesada para a mais leve. */
  perSide: { plate: number; count: number }[];
  /** Peso realmente montado (barra + anilhas dos dois lados). */
  achieved: number;
  /** Diferença entre o alvo e o que dá para montar (0 = exato). */
  diff: number;
  /** Peso total em anilhas por lado. */
  perSideKg: number;
  exact: boolean;
  error: string | null;
};

/**
 * Resolve as anilhas por lado usando um algoritmo guloso sobre as anilhas
 * disponíveis (que é ótimo para os incrementos usuais de academia).
 */
export function calcPlates(
  target: number,
  barKg: number = DEFAULT_BAR_KG,
  available: number[] = DEFAULT_PLATES,
): PlateResult {
  const empty: PlateResult = {
    perSide: [],
    achieved: barKg,
    diff: 0,
    perSideKg: 0,
    exact: true,
    error: null,
  };

  if (!Number.isFinite(target) || target <= 0) {
    return { ...empty, error: "Informe um peso alvo válido." };
  }
  if (!Number.isFinite(barKg) || barKg < 0) {
    return { ...empty, error: "Informe o peso da barra." };
  }
  if (target < barKg) {
    return { ...empty, diff: target - barKg, exact: false, error: `A barra sozinha já pesa ${barKg} kg.` };
  }

  const plates = [...new Set(available.filter((p) => Number.isFinite(p) && p > 0))].sort((a, b) => b - a);
  if (!plates.length) return { ...empty, error: "Nenhuma anilha disponível." };

  // Trabalha em gramas para evitar erro de ponto flutuante.
  let remaining = Math.round(((target - barKg) / 2) * 1000);
  const perSide: { plate: number; count: number }[] = [];

  for (const p of plates) {
    const g = Math.round(p * 1000);
    const count = Math.floor(remaining / g);
    if (count > 0) {
      perSide.push({ plate: p, count });
      remaining -= count * g;
    }
  }

  const perSideKg = perSide.reduce((sum, x) => sum + x.plate * x.count, 0);
  const achieved = Math.round((barKg + perSideKg * 2) * 100) / 100;
  const diff = Math.round((target - achieved) * 100) / 100;

  return {
    perSide,
    achieved,
    diff,
    perSideKg: Math.round(perSideKg * 100) / 100,
    exact: Math.abs(diff) < 0.001,
    error: null,
  };
}

/** Texto curto do tipo "20 + 10 + 2,5 por lado". */
export function formatPerSide(result: PlateResult): string {
  if (!result.perSide.length) return "Só a barra";
  return result.perSide
    .flatMap(({ plate, count }) => Array.from({ length: count }, () => plate.toString().replace(".", ",")))
    .join(" + ") + " por lado";
}
