/**
 * Lógica pura do card "Seu próximo treino".
 * Extraída do Dashboard para poder ser testada de forma automatizada.
 */
import {
  MUSCLE_LABEL,
  proximoNaRotina,
  proximoNaRotinaComRecuperacao,
  type MuscleGroup,
  type RotinaWorkout,
  type TimelineEntry,
} from "@/lib/daily-suggestion";

export type NextWorkoutInput<T extends RotinaWorkout> = {
  workouts: T[];
  /** Id sugerido pela análise do dia (check-in). */
  workoutSugeridoId?: string | null;
  /** Id do último treino do plano efetivamente concluído. */
  lastWorkoutId?: string | null;
  timeline: TimelineEntry[];
  now?: Date;
};

/**
 * 1) sugestão inteligente (plano + recuperação), quando há check-in;
 * 2) senão, rotação considerando a recuperação real dos grupos;
 * 3) senão, rotação pura; 4) senão, primeiro treino da rotina.
 */
export function resolveNextWorkout<T extends RotinaWorkout>({
  workouts,
  workoutSugeridoId,
  lastWorkoutId,
  timeline,
  now = new Date(),
}: NextWorkoutInput<T>): T | null {
  if (workouts.length === 0) return null;
  if (workoutSugeridoId) {
    const w = workouts.find((x) => x.id === workoutSugeridoId);
    if (w) return w;
  }
  return (
    proximoNaRotinaComRecuperacao(workouts, lastWorkoutId ?? null, timeline, now) ??
    proximoNaRotina(workouts, lastWorkoutId ?? null) ??
    workouts[0] ??
    null
  );
}

export type SuggestionLike = {
  grupos?: MuscleGroup[] | string[] | null;
  score?: number;
  intensidade?: string;
  motivo?: string | null;
  scoreDetalhe?: string | null;
} | null;

export type NextWorkoutReason = {
  grupos: string[];
  origem: string;
  recuperacao: string | null;
  scoreDetalhe: string | null;
  motivo: string | null;
};

export function gruposInferidos(label: string | null, name: string | null): MuscleGroup[] {
  const hay = `${label ?? ""} ${name ?? ""}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  const out: MuscleGroup[] = [];
  if (/peito|chest/.test(hay)) out.push("peito");
  if (/costa|dorsal|back|puxada/.test(hay)) out.push("costas");
  if (/perna|quad|leg|posterior|panturr/.test(hay)) out.push("pernas");
  if (/ombro|shoulder|delto/.test(hay)) out.push("ombro");
  if (/bicep/.test(hay)) out.push("biceps");
  if (/tricep/.test(hay)) out.push("triceps");
  if (/gluteo/.test(hay)) out.push("gluteo");
  if (/abdom|core|abs/.test(hay)) out.push("abdomen");
  return out;
}

export function describeNextWorkout<T extends RotinaWorkout>(args: {
  nextWorkout: T | null;
  workoutSugeridoId?: string | null;
  suggestion?: SuggestionLike;
  lastWorkoutId?: string | null;
  /** Motor de Recuperação — autoridade sobre treinar × descansar. */
  recovery?: { status: string; score: number; intensityLabel?: string } | null;
}): NextWorkoutReason | null {
  const { nextWorkout, workoutSugeridoId, suggestion, lastWorkoutId, recovery } = args;
  if (!nextWorkout) return null;
  const usouSugestao = !!workoutSugeridoId && workoutSugeridoId === nextWorkout.id;

  const base =
    usouSugestao && suggestion?.grupos?.length
      ? (suggestion.grupos as string[])
      : gruposInferidos(nextWorkout.label, nextWorkout.name);

  const grupos = base
    .filter((g, i, arr) => arr.indexOf(g) === i)
    .map((g) => MUSCLE_LABEL[g as MuscleGroup] ?? String(g));

  const descanso = suggestion?.intensidade === "descanso" || recovery?.status === "descanso";

  const origem = descanso
    ? "Recuperação pediu descanso — este é o próximo quando você voltar"
    : usouSugestao
      ? "Sugestão do dia (plano + recuperação)"
      : lastWorkoutId
        ? "Rotação do plano após o último treino"
        : "Primeiro treino da sua rotina";

  // Uma única frase de recuperação, na mesma escala do card "Recuperação",
  // com a intensidade já alinhada da "Sugestão de hoje".
  const partes: string[] = [];
  if (recovery) partes.push(`${Math.round(recovery.score)}/100 · ${recovery.status}`);
  else if (typeof suggestion?.score === "number") partes.push(`Score ${suggestion.score.toFixed(1)}/10`);
  if (suggestion?.intensidade) partes.push(`treino ${suggestion.intensidade}`);
  const recuperacao = partes.length ? partes.join(" · ") : null;

  return {
    grupos,
    origem,
    recuperacao,
    scoreDetalhe: suggestion?.scoreDetalhe ?? null,
    motivo: usouSugestao || descanso ? suggestion?.motivo ?? null : null,
  };
}

