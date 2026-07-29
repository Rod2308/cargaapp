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

describe("bordas: histórico insuficiente", () => {
  it("rotina vazia retorna null em ambas as funções", () => {
    expect(proximoNaRotina([], null)).toBeNull();
    expect(proximoNaRotinaComRecuperacao([], null, [], NOW)).toBeNull();
  });

  it("usuário novo (sem histórico) recebe o primeiro treino da rotina", () => {
    expect(proximoNaRotina(ROTINA, null)?.id).toBe("a");
    expect(proximoNaRotinaComRecuperacao(ROTINA, null, [], NOW)?.id).toBe("a");
  });

  it("último treino desconhecido (id inválido) não quebra a rotação", () => {
    expect(proximoNaRotina(ROTINA, "id-inexistente")?.id).toBe("a");
    const tl = combineTimeline([sessao(5, "A", ["Peito", "Tríceps"])], [], NOW);
    const prox = proximoNaRotinaComRecuperacao(ROTINA, "id-inexistente", tl, NOW);
    // com histórico, prefere o treino mais descansado (B/C nunca treinados)
    expect(prox).not.toBeNull();
    for (const g of gruposDoWorkoutNome(String(prox!.label ?? ""), prox!.name)) {
      expect(diasDesdeUltimoEsforco(tl, g, NOW)).toBeGreaterThanOrEqual(MUSCLE_RECOVERY_DAYS[g]);
    }
  });

  it("rotina com um único treino sempre devolve esse treino, mesmo treinado hoje", () => {
    const unica: RotinaWorkout[] = [{ id: "u", label: "A", name: "Full Body" }];
    const tl = combineTimeline([sessao(0, "A", ["Peito", "Costas", "Pernas"])], [], NOW);
    expect(proximoNaRotina(unica, "u")?.id).toBe("u");
    expect(proximoNaRotinaComRecuperacao(unica, "u", tl, NOW)?.id).toBe("u");
  });

  it("histórico só com atividade extra leve não bloqueia a rotação", () => {
    const tl = combineTimeline(
      [],
      [{ started_at: diasAtras(1), ended_at: null, activity_name: "Caminhada leve", duration_min: 30 }],
      NOW,
    );
    expect(tl.length).toBe(1);
    expect(proximoNaRotinaComRecuperacao(ROTINA, "a", tl, NOW)?.id).toBe("b");
  });

  it("sessões com mais de 7 dias são ignoradas na timeline", () => {
    const tl = combineTimeline([sessao(9, "B", ["Costas", "Bíceps"])], [], NOW);
    expect(tl).toHaveLength(0);
    expect(diasDesdeUltimoEsforco(tl, "biceps", NOW)).toBe(Number.POSITIVE_INFINITY);
  });

  it("labels sem letra (rotina livre) mantêm a ordem original", () => {
    const livre: RotinaWorkout[] = [
      { id: "x", label: null, name: "Treino Superior" },
      { id: "y", label: null, name: "Treino Inferior" },
    ];
    expect(ordenarRotina(livre).map((w) => w.id)).toEqual(["x", "y"]);
    expect(proximoNaRotina(livre, "x")?.id).toBe("y");
  });
});

describe("bordas: múltiplos treinos na mesma semana", () => {
  it("respeita o treino mais recente quando o mesmo grupo aparece duas vezes", () => {
    const tl = combineTimeline(
      [sessao(4, "B", ["Costas", "Bíceps"]), sessao(1, "B", ["Costas", "Bíceps"])],
      [],
      NOW,
    );
    expect(diasDesdeUltimoEsforco(tl, "biceps", NOW)).toBe(1);
    expect(proximoNaRotinaComRecuperacao(ROTINA, "b", tl, NOW)?.id).not.toBe("b");
  });

  it("dois treinos no mesmo dia: escolhe o treino com grupos ainda intocados", () => {
    const tl = combineTimeline(
      [sessao(0, "A", ["Peito", "Tríceps"]), sessao(0, "B", ["Costas", "Bíceps"])],
      [],
      NOW,
    );
    expect(proximoNaRotinaComRecuperacao(ROTINA, "b", tl, NOW)?.id).toBe("c");
  });

  it("semana cheia (6 sessões) nunca sugere grupo fora do prazo se houver opção válida", () => {
    const tl = combineTimeline(
      [
        sessao(5, "A", ["Peito", "Tríceps"]),
        sessao(4, "B", ["Costas", "Bíceps"]),
        sessao(3, "C", ["Pernas", "Glúteo"]),
        sessao(2, "A", ["Peito", "Tríceps"]),
        sessao(1, "B", ["Costas", "Bíceps"]),
        sessao(0, "C", ["Pernas", "Glúteo"]),
      ],
      [],
      NOW,
    );
    const prox = proximoNaRotinaComRecuperacao(ROTINA, "c", tl, NOW);
    expect(prox?.id).toBe("a");
    for (const g of gruposDoWorkoutNome(String(prox!.label ?? ""), prox!.name)) {
      expect(diasDesdeUltimoEsforco(tl, g, NOW)).toBeGreaterThanOrEqual(MUSCLE_RECOVERY_DAYS[g]);
    }
  });

  it("cardio intenso recente não impede a sugestão de treino de membros superiores", () => {
    const tl = combineTimeline(
      [sessao(0, "C", ["Pernas", "Glúteo"])],
      [{ started_at: diasAtras(0), ended_at: null, activity_name: "Corrida", duration_min: 45 }],
      NOW,
    );
    const prox = proximoNaRotinaComRecuperacao(ROTINA, "c", tl, NOW);
    expect(["a", "b"]).toContain(prox?.id);
  });
});
