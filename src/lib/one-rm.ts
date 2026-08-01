import { weekKey as weekKeyLocal, weekStart as weekStartLocal } from "./week";
// Cálculo de 1RM estimado (e1RM) e agregações semanais de progressão.
// Determinístico e sem dependências — usado no painel de progressão.

export type OneRmSet = {
  weight_kg: number | null;
  reps: number | null;
  rpe: number | null;
  date: string; // ISO date/datetime
};

export type OneRmFormula = "epley" | "brzycki";

/** Ajusta reps efetivas quando há RPE (RPE 10 = falha; cada ponto abaixo ≈ 1 rep na reserva). */
function effectiveReps(reps: number, rpe: number | null): number {
  if (rpe == null || rpe <= 0 || rpe >= 10) return reps;
  const rir = Math.max(0, Math.min(5, 10 - rpe));
  return reps + rir;
}

/** e1RM de uma série. Retorna null quando não há dados suficientes. */
export function estimateOneRm(
  weight: number | null,
  reps: number | null,
  rpe: number | null = null,
  formula: OneRmFormula = "epley",
): number | null {
  if (!weight || weight <= 0 || !reps || reps <= 0) return null;
  const r = Math.min(20, effectiveReps(reps, rpe));
  if (r === 1) return weight;
  const value =
    formula === "brzycki"
      ? r < 37
        ? weight * (36 / (37 - r))
        : weight * (1 + r / 30)
      : weight * (1 + r / 30);
  return Math.round(value * 10) / 10;
}

/** Melhor e1RM de um conjunto de séries. */
export function bestOneRm(sets: OneRmSet[], formula: OneRmFormula = "epley"): number | null {
  let best: number | null = null;
  for (const s of sets) {
    const e = estimateOneRm(s.weight_kg, s.reps, s.rpe, formula);
    if (e != null && (best == null || e > best)) best = e;
  }
  return best;
}

/** Arredonda para o incremento mais próximo (padrão 2,5 kg). */
export function roundToPlate(kg: number, step = 2.5): number {
  if (!Number.isFinite(kg) || kg <= 0) return 0;
  return Math.round(kg / step) * step;
}

/** Percentual de 1RM aproximado para um número de repetições (tabela de Epley invertida). */
export function percentForReps(reps: number): number {
  if (reps <= 1) return 1;
  return 1 / (1 + Math.min(20, reps) / 30);
}

export type LoadSuggestion = {
  reps: number;
  percent: number;
  weight: number;
  label: string;
};

/** Cargas sugeridas por faixa de repetições a partir do e1RM. */
export function suggestLoads(oneRm: number, step = 2.5): LoadSuggestion[] {
  const targets: Array<{ reps: number; label: string }> = [
    { reps: 3, label: "Força" },
    { reps: 5, label: "Força" },
    { reps: 8, label: "Hipertrofia" },
    { reps: 10, label: "Hipertrofia" },
    { reps: 12, label: "Resistência" },
    { reps: 15, label: "Resistência" },
  ];
  return targets.map((t) => {
    const percent = percentForReps(t.reps);
    return {
      reps: t.reps,
      percent,
      weight: roundToPlate(oneRm * percent, step),
      label: t.label,
    };
  });
}

/** Chave da semana civil (domingo) — YYYY-MM-DD do domingo, no fuso do usuário. */
export function weekKey(dateStr: string): string {
  return weekKeyLocal(dateStr.length <= 10 ? `${dateStr}T12:00:00` : dateStr);
}

/** Domingo 00:00 (fuso do usuário) da semana de uma data. */
export function weekStart(dateStr: string): Date {
  return weekStartLocal(dateStr.length <= 10 ? `${dateStr}T12:00:00` : dateStr);
}

export type WeeklyPoint = {
  week: string;
  start: Date;
  e1rm: number | null;
  maxWeight: number;
  volume: number;
  sets: number;
  reps: number;
};

/** Série semanal de e1RM, carga máxima e volume. Ordenada da mais antiga para a mais recente. */
export function weeklyProgression(
  sets: OneRmSet[],
  formula: OneRmFormula = "epley",
): WeeklyPoint[] {
  const map = new Map<string, WeeklyPoint>();
  for (const s of sets) {
    if (!s.date) continue;
    const key = weekKey(s.date);
    const cur =
      map.get(key) ??
      ({
        week: key,
        start: weekStart(s.date),
        e1rm: null,
        maxWeight: 0,
        volume: 0,
        sets: 0,
        reps: 0,
      } satisfies WeeklyPoint);
    const e = estimateOneRm(s.weight_kg, s.reps, s.rpe, formula);
    if (e != null && (cur.e1rm == null || e > cur.e1rm)) cur.e1rm = e;
    cur.maxWeight = Math.max(cur.maxWeight, s.weight_kg ?? 0);
    cur.volume += (s.weight_kg ?? 0) * (s.reps ?? 0);
    cur.reps += s.reps ?? 0;
    cur.sets += 1;
    map.set(key, cur);
  }
  return Array.from(map.values()).sort((a, b) => a.start.getTime() - b.start.getTime());
}

export type ProgressTrend = {
  current: number | null;
  previous: number | null;
  deltaKg: number | null;
  deltaPct: number | null;
  weeks: number;
  direction: "up" | "down" | "flat" | "unknown";
  message: string;
};

/** Compara o e1RM da semana mais recente com a última semana anterior com dados. */
export function progressTrend(points: WeeklyPoint[]): ProgressTrend {
  const withE1rm = points.filter((p) => p.e1rm != null);
  const current = withE1rm.length ? withE1rm[withE1rm.length - 1].e1rm! : null;
  const previous = withE1rm.length > 1 ? withE1rm[withE1rm.length - 2].e1rm! : null;
  if (current == null) {
    return {
      current: null,
      previous: null,
      deltaKg: null,
      deltaPct: null,
      weeks: withE1rm.length,
      direction: "unknown",
      message: "Registre séries com carga e repetições para estimar seu 1RM.",
    };
  }
  if (previous == null) {
    return {
      current,
      previous: null,
      deltaKg: null,
      deltaPct: null,
      weeks: 1,
      direction: "unknown",
      message: "Primeira semana registrada — a comparação aparece na próxima.",
    };
  }
  const deltaKg = Math.round((current - previous) * 10) / 10;
  const deltaPct = Math.round((deltaKg / previous) * 1000) / 10;
  const direction = deltaKg > 0.4 ? "up" : deltaKg < -0.4 ? "down" : "flat";
  const message =
    direction === "up"
      ? `Ganho de ${deltaKg.toFixed(1)} kg (${deltaPct.toFixed(1)}%) no 1RM estimado vs. semana anterior.`
      : direction === "down"
        ? `Queda de ${Math.abs(deltaKg).toFixed(1)} kg (${Math.abs(deltaPct).toFixed(1)}%) — pode ser fadiga ou semana mais leve.`
        : "1RM estimado estável em relação à semana anterior.";
  return { current, previous, deltaKg, deltaPct, weeks: withE1rm.length, direction, message };
}

/** Sugestão de carga para o próximo treino: pequena progressão sobre a melhor série recente. */
export function nextSessionSuggestion(
  points: WeeklyPoint[],
  targetReps: number,
  step = 2.5,
): { weight: number; note: string } | null {
  const withE1rm = points.filter((p) => p.e1rm != null);
  if (!withE1rm.length) return null;
  const trend = progressTrend(points);
  const base = withE1rm[withE1rm.length - 1].e1rm!;
  const factor = trend.direction === "down" ? 0.97 : trend.direction === "up" ? 1.025 : 1.015;
  const weight = roundToPlate(base * percentForReps(targetReps) * factor, step);
  const note =
    trend.direction === "down"
      ? "Semana em queda: reduza um pouco e priorize técnica/recuperação."
      : trend.direction === "up"
        ? "Você está progredindo: suba ~2,5% na carga."
        : "Progressão leve para manter o estímulo.";
  return { weight, note };
}
