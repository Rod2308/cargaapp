// Progressão automática: varre todos os treinos do usuário, calcula a sugestão
// de carga/descanso por exercício (mesma matemática de `progression.ts`) e
// devolve os ajustes pendentes. O `applyAutoProgression` grava as mudanças
// passando pela fila offline, para funcionar mesmo sem internet.

import { supabase } from "@/integrations/supabase/client";
import {
  suggestAdjustment,
  hasChange,
  type CardioLoad,
  type SetRow,
  type Suggestion,
} from "@/lib/progression";

export type AutoAdjustment = {
  itemId: string;
  workoutId: string;
  workoutName: string;
  exerciseName: string;
  currentWeight: number | null;
  currentRest: number;
  suggestion: Suggestion;
  patch: { target_weight_kg?: number | null; target_rest_seconds?: number };
};

const LOOKBACK_SETS_DAYS = 60;
const LOOKBACK_CARDIO_DAYS = 14;

/** Chave por usuário/dia usada para rodar a automação no máximo 1x ao dia. */
export function autoRunKey(userId: string, date = new Date()): string {
  return `auto-progression:last-run:${userId}:${date.toISOString().slice(0, 10)}`;
}

export function autoEnabledKey(userId: string): string {
  return `auto-progression:enabled:${userId}`;
}

export function isAutoEnabled(userId: string): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(autoEnabledKey(userId)) === "1";
}

export function setAutoEnabled(userId: string, enabled: boolean) {
  if (typeof window === "undefined") return;
  if (enabled) localStorage.setItem(autoEnabledKey(userId), "1");
  else localStorage.removeItem(autoEnabledKey(userId));
}

export function ranToday(userId: string): boolean {
  if (typeof window === "undefined") return true;
  return localStorage.getItem(autoRunKey(userId)) != null;
}

export function markRanToday(userId: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(autoRunKey(userId), new Date().toISOString());
}

/** Calcula (sem gravar) todos os ajustes pendentes do usuário. */
export async function computeAutoProgression(userId: string): Promise<AutoAdjustment[]> {
  const { data: workouts, error: wErr } = await supabase
    .from("workouts")
    .select("id, name, label")
    .eq("user_id", userId)
    .order("order_idx");
  if (wErr) throw wErr;
  const workoutIds = (workouts ?? []).map((w) => w.id);
  if (workoutIds.length === 0) return [];

  const { data: items, error: iErr } = await supabase
    .from("workout_exercises")
    .select("id, workout_id, target_weight_kg, target_rest_seconds, target_reps, exercises(name)")
    .in("workout_id", workoutIds);
  if (iErr) throw iErr;
  const itemIds = (items ?? []).map((i) => i.id);
  if (itemIds.length === 0) return [];

  const sinceSets = new Date(Date.now() - LOOKBACK_SETS_DAYS * 24 * 3600 * 1000).toISOString();
  const { data: sets, error: sErr } = await supabase
    .from("session_sets")
    .select("weight_kg, reps, rpe, session_id, completed_at, workout_exercise_id")
    .in("workout_exercise_id", itemIds)
    .gte("completed_at", sinceSets)
    .order("completed_at", { ascending: false })
    .limit(2000);
  if (sErr) throw sErr;

  const sinceCardio = new Date(Date.now() - LOOKBACK_CARDIO_DAYS * 24 * 3600 * 1000).toISOString();
  const { data: cardio } = await supabase
    .from("sessions")
    .select("started_at, ended_at, avg_hr, max_hr, calories, distance_m, activity_type, workout_id")
    .eq("user_id", userId)
    .neq("source", "manual")
    .gte("started_at", sinceCardio)
    .order("started_at", { ascending: false });

  const workoutById = new Map((workouts ?? []).map((w) => [w.id, w]));
  const setsByItem = new Map<string, SetRow[]>();
  for (const row of (sets ?? []) as any[]) {
    const list = setsByItem.get(row.workout_exercise_id) ?? [];
    list.push(row as SetRow);
    setsByItem.set(row.workout_exercise_id, list);
  }

  const out: AutoAdjustment[] = [];
  for (const it of (items ?? []) as any[]) {
    const rows = setsByItem.get(it.id) ?? [];
    // Fadiga: cardio ligado a este treino + cardio geral (sem treino vinculado).
    const cardioLoads = ((cardio ?? []) as any[]).filter(
      (c) => c.workout_id === it.workout_id || c.workout_id == null,
    ) as CardioLoad[];

    const suggestion = suggestAdjustment({
      currentWeight: it.target_weight_kg ?? null,
      currentRest: it.target_rest_seconds,
      repRange: it.target_reps,
      rows,
      cardioLoads,
    });
    const change = hasChange(suggestion, it.target_weight_kg ?? null, it.target_rest_seconds);
    if (!change.any) continue;

    const patch: AutoAdjustment["patch"] = {};
    if (change.loadChanged) patch.target_weight_kg = suggestion.suggested_weight_kg;
    if (change.restChanged) patch.target_rest_seconds = suggestion.suggested_rest_seconds ?? undefined;

    const w = workoutById.get(it.workout_id);
    out.push({
      itemId: it.id,
      workoutId: it.workout_id,
      workoutName: w ? `${w.label} · ${w.name}` : "Treino",
      exerciseName: it.exercises?.name ?? "Exercício",
      currentWeight: it.target_weight_kg ?? null,
      currentRest: it.target_rest_seconds,
      suggestion,
      patch,
    });
  }
  return out;
}

/**
 * Um ajuste exige confirmação explícita quando REDUZ carga ou quando é
 * "grande" (variação de carga >= 10% ou mudança de descanso >= 30s).
 */
export const BIG_LOAD_PCT = 0.1;
export const BIG_REST_SECONDS = 30;

export type AdjustmentImpact = {
  loadDeltaKg: number | null;
  loadDeltaPct: number | null;
  restDeltaSeconds: number | null;
  isReduction: boolean;
  isBig: boolean;
  requiresConfirmation: boolean;
};

export function adjustmentImpact(a: AutoAdjustment): AdjustmentImpact {
  const newWeight = a.patch.target_weight_kg;
  const loadDeltaKg =
    newWeight != null && a.currentWeight != null ? Number(newWeight) - Number(a.currentWeight) : null;
  const loadDeltaPct =
    loadDeltaKg != null && a.currentWeight ? loadDeltaKg / Math.abs(Number(a.currentWeight)) : null;
  const restDeltaSeconds =
    a.patch.target_rest_seconds != null ? a.patch.target_rest_seconds - a.currentRest : null;

  const isReduction = a.suggestion.loadDirection === "down" || (loadDeltaKg != null && loadDeltaKg < 0);
  const isBig =
    (loadDeltaPct != null && Math.abs(loadDeltaPct) >= BIG_LOAD_PCT) ||
    (restDeltaSeconds != null && Math.abs(restDeltaSeconds) >= BIG_REST_SECONDS);

  return {
    loadDeltaKg,
    loadDeltaPct,
    restDeltaSeconds,
    isReduction,
    isBig,
    requiresConfirmation: isReduction || isBig,
  };
}

export function splitByConfirmation(list: AutoAdjustment[]) {
  const auto: AutoAdjustment[] = [];
  const needsConfirmation: AutoAdjustment[] = [];
  for (const a of list) {
    (adjustmentImpact(a).requiresConfirmation ? needsConfirmation : auto).push(a);
  }
  return { auto, needsConfirmation };
}

/** Frases curtas com o desempenho e a fadiga que motivaram o ajuste. */
export function buildEvidence(a: AutoAdjustment): string[] {
  const out: string[] = [];
  const fmt = (n: number, d = 1) =>
    (Math.round(n * 10 ** d) / 10 ** d).toString().replace(".", ",");

  const sessions = a.suggestion.sessions ?? [];
  if (sessions.length === 0) {
    out.push("Sem séries registradas no período — ajuste baseado no plano atual.");
  } else {
    for (const s of sessions.slice(0, 3)) {
      const date = new Date(s.date).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
      const bits: string[] = [];
      if (s.avgLoad != null) bits.push(`${fmt(s.avgLoad)} kg`);
      if (s.avgReps != null) bits.push(`${fmt(s.avgReps)} reps`);
      if (s.avgRpe != null) bits.push(`RPE ${fmt(s.avgRpe)}`);
      bits.push(`${s.setCount} série${s.setCount === 1 ? "" : "s"}`);
      out.push(`${date}: ${bits.join(" · ")}`);
    }
  }

  const cf = a.suggestion.cardioFatigue;
  if (cf && cf.level !== "none" && cf.summary) {
    out.push(`Fadiga ${cf.level === "high" ? "alta" : "moderada"} — ${cf.summary}`);
  } else if (cf && cf.count > 0) {
    out.push(`Fadiga baixa — ${cf.count} sessão(ões) de cardio leve nos últimos 7 dias`);
  }

  out.push(`Confiança da análise: ${
    a.suggestion.confidence === "high" ? "alta" : a.suggestion.confidence === "medium" ? "média" : "baixa"
  }`);
  return out;
}

/** Grava os ajustes informados (usa a fila offline). Retorna quantos foram aplicados. */
export async function applyAutoProgression(adjustments: AutoAdjustment[]): Promise<number> {
  if (adjustments.length === 0) return 0;
  const { writeUpdate } = await import("@/lib/offline-writes");
  let applied = 0;
  for (const a of adjustments) {
    try {
      await writeUpdate("workout_exercises", { id: a.itemId }, a.patch);
      applied++;
    } catch {
      // segue para os próximos; falhas permanentes já são registradas pela fila
    }
  }
  return applied;
}
