import { describe, expect, it } from "vitest";
import {
  MUSCLE_RECOVERY_DAYS,
  combineTimeline,
  diasDesdeUltimoEsforco,
  gruposDoWorkoutNome,
  gruposLiberados,
  ordenarRotina,
  proximoNaRotina,
  proximoNaRotinaComRecuperacao,
  type RotinaWorkout,
  type WorkoutSession,
} from "./daily-suggestion";

const NOW = new Date("2026-07-29T12:00:00.000Z");

function diasAtras(n: number): string {
  return new Date(NOW.getTime() - n * 86400_000).toISOString();
}

function sessao(diasAtrasN: number, label: string, grupos: string[]): WorkoutSession {
  return {
    started_at: diasAtras(diasAtrasN),
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

describe("regras de recuperação", () => {
  it("bíceps e tríceps exigem 2 dias de recuperação", () => {
    expect(MUSCLE_RECOVERY_DAYS.biceps).toBe(2);
    expect(MUSCLE_RECOVERY_DAYS.triceps).toBe(2);
  });

  it("calcula dias desde o último esforço por grupo", () => {
    const tl = combineTimeline([sessao(2, "B", ["Bíceps", "Costas"])], [], NOW);
    expect(diasDesdeUltimoEsforco(tl, "biceps", NOW)).toBe(2);
    expect(diasDesdeUltimoEsforco(tl, "peito", NOW)).toBe(Number.POSITIVE_INFINITY);
  });

  it("não libera grupo treinado ontem, libera após o prazo", () => {
    const ontem = combineTimeline([sessao(1, "B", ["Bíceps"])], [], NOW);
    expect(gruposLiberados(ontem, NOW).map((g) => g.grupo)).not.toContain("biceps");

    const anteontem = combineTimeline([sessao(2, "B", ["Bíceps"])], [], NOW);
    expect(gruposLiberados(anteontem, NOW).map((g) => g.grupo)).toContain("biceps");
  });
});

describe("rotação da rotina", () => {
  it("ordena por letra e cicla A → B → C → A", () => {
    const fora = [ROTINA[2], ROTINA[0], ROTINA[1]];
    expect(ordenarRotina(fora).map((w) => w.id)).toEqual(["a", "b", "c"]);
    expect(proximoNaRotina(ROTINA, null)?.id).toBe("a");
    expect(proximoNaRotina(ROTINA, "a")?.id).toBe("b");
    expect(proximoNaRotina(ROTINA, "c")?.id).toBe("a");
  });

  it("sem histórico usa a rotação simples", () => {
    expect(proximoNaRotinaComRecuperacao(ROTINA, "a", [], NOW)?.id).toBe("b");
  });
});

describe("próximo treino nunca repete músculo recente", () => {
  it("pula o treino de bíceps feito há 1 dia", () => {
    // Último concluído: A (peito/tríceps) hoje; B (costas/bíceps) foi ontem.
    const tl = combineTimeline(
      [sessao(0, "A", ["Peito", "Tríceps"]), sessao(1, "B", ["Costas", "Bíceps"])],
      [],
      NOW,
    );
    const prox = proximoNaRotinaComRecuperacao(ROTINA, "a", tl, NOW);
    expect(prox?.id).toBe("c");
  });

  it("escolhe sempre um treino com todos os grupos recuperados quando existe", () => {
    const cenarios: Array<{ ultimo: string; sessoes: WorkoutSession[] }> = [
      { ultimo: "a", sessoes: [sessao(0, "A", ["Peito", "Tríceps"]), sessao(1, "B", ["Costas", "Bíceps"])] },
      { ultimo: "b", sessoes: [sessao(0, "B", ["Costas", "Bíceps"]), sessao(1, "C", ["Pernas"])] },
      { ultimo: "c", sessoes: [sessao(0, "C", ["Pernas"]), sessao(1, "A", ["Peito", "Tríceps"])] },
    ];

    for (const { ultimo, sessoes } of cenarios) {
      const tl = combineTimeline(sessoes, [], NOW);
      const prox = proximoNaRotinaComRecuperacao(ROTINA, ultimo, tl, NOW);
      expect(prox).not.toBeNull();
      const grupos = gruposDoWorkoutNome(String(prox!.label ?? ""), prox!.name);
      for (const g of grupos) {
        expect(diasDesdeUltimoEsforco(tl, g, NOW)).toBeGreaterThanOrEqual(MUSCLE_RECOVERY_DAYS[g]);
      }
    }
  });

  it("com tudo recente, prefere o treino descansado há mais tempo", () => {
    const tl = combineTimeline(
      [
        sessao(0, "A", ["Peito", "Tríceps"]),
        sessao(1, "C", ["Pernas", "Glúteo"]),
        sessao(0, "B", ["Costas", "Bíceps"]),
      ],
      [],
      NOW,
    );
    const prox = proximoNaRotinaComRecuperacao(ROTINA, "b", tl, NOW);
    expect(prox?.id).toBe("c");
  });
});
