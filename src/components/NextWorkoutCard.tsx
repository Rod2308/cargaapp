import { Play, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { NextWorkoutReason } from "@/lib/next-workout";

export type NextWorkoutCardWorkout = { id: string; label: string | null; name: string };

export type NextWorkoutCardProps = {
  loading?: boolean;
  workout: NextWorkoutCardWorkout | null;
  reason?: NextWorkoutReason | null;
  isRestDay?: boolean;
  hasLastSession?: boolean;
  exerciseCount?: number | null;
  starting?: boolean;
  onStart: (workoutId: string) => void;
  onCreate: () => void;
};

export function NextWorkoutCard({
  loading,
  workout,
  reason,
  isRestDay,
  hasLastSession,
  exerciseCount,
  starting,
  onStart,
  onCreate,
}: NextWorkoutCardProps) {
  if (loading) {
    return (
      <div
        data-testid="next-workout-loading"
        className="card-lift col-span-2 row-span-2 flex flex-col items-start gap-4 p-5 sm:p-7 md:col-span-2 md:min-h-[280px]"
      >
        <div className="h-3 w-28 animate-pulse rounded-full bg-muted" />
        <div className="h-16 w-40 animate-pulse rounded-2xl bg-muted" />
        <div className="h-4 w-48 animate-pulse rounded-full bg-muted" />
        <div className="mt-auto h-10 w-36 animate-pulse rounded-full bg-muted" />
      </div>
    );
  }

  if (!workout) {
    return (
      <div className="card-lift col-span-2 row-span-2 flex flex-col items-start p-5 sm:p-7 md:col-span-2">
        <span className="text-eyebrow text-muted-foreground">Nenhum treino agendado</span>
        <p className="mt-2 font-display text-2xl">Crie sua rotina de treinos</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Monte seus treinos (A, B, C…) e o app passa a indicar automaticamente o próximo da sequência.
        </p>
        <Button className="mt-4" onClick={onCreate}>
          <Plus className="size-4" /> Criar treino
        </Button>
      </div>
    );
  }

  return (
    <button
      data-testid="next-workout-card"
      onClick={() => onStart(workout.id)}
      disabled={starting}
      className="card-ink grid-noise col-span-2 row-span-2 flex flex-col items-start p-5 text-left transition-opacity duration-300 sm:p-7 md:col-span-2 md:min-h-[280px]"
    >
      <span className="text-eyebrow text-white/60">Seu próximo treino</span>
      <div className="mt-3 flex flex-wrap items-end gap-3">
        <span
          data-testid="next-workout-label"
          className="font-display text-6xl font-black leading-none text-brand sm:text-7xl md:text-8xl"
        >
          {workout.label}
        </span>
        <span data-testid="next-workout-name" className="mb-1 font-display text-xl leading-tight sm:text-2xl">
          {workout.name}
        </span>
      </div>
      <span className="mt-2 text-xs text-white/60">
        {isRestDay
          ? "Hoje é dia de descanso — mantenha o foco na recuperação. Se quiser, treine leve."
          : [
              hasLastSession ? `Depois do último treino registrado` : "Primeiro treino da sua rotina",
              exerciseCount ? `${exerciseCount} exercício${exerciseCount > 1 ? "s" : ""}` : null,
            ]
              .filter(Boolean)
              .join(" · ")}
      </span>

      {reason ? (
        <div className="mt-4 w-full rounded-2xl bg-white/5 p-3">
          <span className="text-eyebrow text-white/50">Por que este treino?</span>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {reason.grupos.length > 0 ? (
              <span
                data-testid="next-workout-grupos"
                className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] text-white/80"
              >
                Grupo: {reason.grupos.join(", ")}
              </span>
            ) : null}
            {reason.recuperacao ? (
              <span
                data-testid="next-workout-recuperacao"
                className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] text-white/80"
              >
                Recuperação: {reason.recuperacao}
              </span>
            ) : null}
            <span
              data-testid="next-workout-origem"
              className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] text-white/80"
            >
              Sugestão: {reason.origem}
            </span>
          </div>
          {reason.motivo ? (
            <p className="mt-2 text-[11px] leading-snug text-white/60">{reason.motivo}</p>
          ) : null}
          {reason.scoreDetalhe ? (
            <p className="mt-1 text-[11px] leading-snug text-white/40">{reason.scoreDetalhe}</p>
          ) : null}
        </div>
      ) : null}

      <span className="mt-auto pt-6 inline-flex items-center gap-2 rounded-full bg-brand px-4 py-2 text-sm font-semibold text-brand-foreground shadow-brand">
        <Play className="size-4 fill-current" /> Iniciar treino
      </span>
    </button>
  );
}
