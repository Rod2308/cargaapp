import { describe, expect, it, vi, afterEach } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { NextWorkoutCard } from "./NextWorkoutCard";
import {
  combineTimeline,
  type RotinaWorkout,
  type WorkoutSession,
} from "@/lib/daily-suggestion";
import { describeNextWorkout, resolveNextWorkout } from "@/lib/next-workout";

const NOW = new Date("2026-07-29T12:00:00.000Z");

function diasAtras(n: number): string {
  return new Date(NOW.getTime() - n * 86400_000).toISOString();
}

function sessao(n: number, label: string, grupos: string[]): WorkoutSession {
  return {
    started_at: diasAtras(n),
    ended_at: null,
    workout_label: label,
    workout_name: `Treino ${label}`,
    muscle_groups: grupos,
  };
}

const ROTINA: RotinaWorkout[] = [
  { id: "a", label: "A", name: "Peito e Tríceps" },
  { id: "b", label: "B", name: "Costas e Bíceps" },
  { id: "c", label: "C", name: "Pernas e Glúteo" },
];

/** Renderiza o card exatamente como o Dashboard faz: lógica + UI. */
function renderDashboardCard(opts: {
  workouts?: RotinaWorkout[];
  sessoes?: WorkoutSession[];
  lastWorkoutId?: string | null;
  workoutSugeridoId?: string | null;
  suggestion?: Parameters<typeof describeNextWorkout>[0]["suggestion"];
  loading?: boolean;
  onStart?: (id: string) => void;
  onCreate?: () => void;
}) {
  const workouts = opts.workouts ?? ROTINA;
  const timeline = combineTimeline(opts.sessoes ?? [], [], NOW);
  const nextWorkout = resolveNextWorkout({
    workouts,
    workoutSugeridoId: opts.workoutSugeridoId ?? null,
    lastWorkoutId: opts.lastWorkoutId ?? null,
    timeline,
    now: NOW,
  });
  const reason = describeNextWorkout({
    nextWorkout,
    workoutSugeridoId: opts.workoutSugeridoId ?? null,
    suggestion: opts.suggestion ?? null,
    lastWorkoutId: opts.lastWorkoutId ?? null,
  });
  render(
    <NextWorkoutCard
      loading={opts.loading}
      workout={nextWorkout}
      reason={reason}
      hasLastSession={!!opts.lastWorkoutId}
      exerciseCount={5}
      onStart={opts.onStart ?? (() => {})}
      onCreate={opts.onCreate ?? (() => {})}
    />,
  );
  return { nextWorkout, timeline };
}

afterEach(() => cleanup());

describe("UI · Seu próximo treino", () => {
  it("mostra o próximo da rotação quando não há histórico", () => {
    renderDashboardCard({});
    expect(screen.getByText("Seu próximo treino")).toBeTruthy();
    expect(screen.getByTestId("next-workout-label").textContent).toBe("A");
    expect(screen.getByTestId("next-workout-origem").textContent).toContain(
      "Primeiro treino da sua rotina",
    );
  });

  it("não exibe treino cujos músculos ainda estão em recuperação (bíceps há 1 dia)", () => {
    renderDashboardCard({
      lastWorkoutId: "a",
      sessoes: [sessao(0, "A", ["Peito", "Tríceps"]), sessao(1, "B", ["Costas", "Bíceps"])],
    });
    // B (costas/bíceps) foi ontem → a UI deve mostrar C
    expect(screen.getByTestId("next-workout-label").textContent).toBe("C");
    expect(screen.getByTestId("next-workout-name").textContent).toContain("Pernas");
    expect(screen.getByTestId("next-workout-origem").textContent).toContain(
      "Rotação do plano após o último treino",
    );
  });

  it("segue a rotação normal quando todos os grupos estão recuperados", () => {
    renderDashboardCard({
      lastWorkoutId: "a",
      sessoes: [sessao(3, "A", ["Peito", "Tríceps"]), sessao(4, "B", ["Costas", "Bíceps"])],
    });
    expect(screen.getByTestId("next-workout-label").textContent).toBe("B");
  });

  it("prioriza a sugestão do dia (check-in) e mostra score e motivo", () => {
    renderDashboardCard({
      workoutSugeridoId: "c",
      lastWorkoutId: "a",
      sessoes: [sessao(1, "B", ["Costas", "Bíceps"])],
      suggestion: {
        grupos: ["pernas", "gluteo"],
        score: 7.25,
        intensidade: "alta",
        motivo: "Pernas descansadas há 6 dias.",
        scoreDetalhe: "sono 8h · estresse baixo",
      },
    });
    expect(screen.getByTestId("next-workout-label").textContent).toBe("C");
    expect(screen.getByTestId("next-workout-origem").textContent).toContain(
      "Sugestão do dia (plano + recuperação)",
    );
    expect(screen.getByTestId("next-workout-recuperacao").textContent).toContain("Score 7.3/10");
    expect(screen.getByTestId("next-workout-recuperacao").textContent).toContain("alta");
    expect(screen.getByText("Pernas descansadas há 6 dias.")).toBeTruthy();
    expect(screen.getByTestId("next-workout-grupos").textContent).toContain("Pernas");
  });

  it("exibe os grupos inferidos do treino escolhido pela rotação", () => {
    renderDashboardCard({ lastWorkoutId: "c", sessoes: [sessao(0, "C", ["Pernas"])] });
    const grupos = screen.getByTestId("next-workout-grupos").textContent ?? "";
    expect(grupos).toContain("Peito");
    expect(grupos).toContain("Tríceps");
  });

  it("dispara o início da sessão com o id do treino recomendado", () => {
    const onStart = vi.fn();
    const { nextWorkout } = renderDashboardCard({
      lastWorkoutId: "a",
      sessoes: [sessao(0, "A", ["Peito", "Tríceps"]), sessao(1, "B", ["Costas", "Bíceps"])],
      onStart,
    });
    fireEvent.click(screen.getByTestId("next-workout-card"));
    expect(onStart).toHaveBeenCalledWith(nextWorkout!.id);
    expect(nextWorkout!.id).toBe("c");
  });

  it("mostra o estado de carregamento sem recomendar nada", () => {
    renderDashboardCard({ loading: true });
    expect(screen.getByTestId("next-workout-loading")).toBeTruthy();
    expect(screen.queryByTestId("next-workout-card")).toBeNull();
  });

  it("sem treinos cadastrados, convida a criar a rotina", () => {
    const onCreate = vi.fn();
    renderDashboardCard({ workouts: [], onCreate });
    expect(screen.getByText("Nenhum treino agendado")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /criar treino/i }));
    expect(onCreate).toHaveBeenCalled();
  });
});
