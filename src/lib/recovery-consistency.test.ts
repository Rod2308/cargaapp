import { describe, expect, it } from "vitest";
import {
  alinharComRecuperacao,
  recuperacaoExigeDescanso,
  sugerirTreinoDoDia,
  type DailyCheckin,
  type Intensidade,
  type RecoveryAuthority,
  type Sugestao,
  type WorkoutSession,
} from "./daily-suggestion";
import { scoreToStatus, unifySleepSources } from "./recovery-core";
import {
  MUSCLE_RECOVERY_DAYS,
  isMuscleRecovered,
  normalizeMuscleGroup,
  MUSCLE_GROUPS,
} from "./muscle-recovery";

const HOJE = new Date("2026-07-30T12:00:00.000Z");

function diasAtras(d: number): string {
  return new Date(HOJE.getTime() - d * 86_400_000).toISOString();
}

function sessao(dias: number, grupos: string[]): WorkoutSession {
  return {
    started_at: diasAtras(dias),
    ended_at: diasAtras(dias),
    workout_label: "A",
    workout_name: "Treino",
    muscle_groups: grupos,
  };
}

/** Histórico suficiente pra sair do caminho "pouco histórico". */
const HISTORICO: WorkoutSession[] = [
  sessao(1, ["Peito", "Tríceps"]),
  sessao(3, ["Costas", "Bíceps"]),
  sessao(5, ["Pernas"]),
];

const CHECKIN_OTIMO: DailyCheckin = {
  sleep_hours: 8.5,
  sleep_quality: 5,
  soreness: 1,
  energy: 5,
};

const CHECKIN_RUIM: DailyCheckin = {
  sleep_hours: 4,
  sleep_quality: 2,
  soreness: 5,
  energy: 1,
};

const RANK: Record<Intensidade, number> = { descanso: 0, leve: 1, moderada: 2, alta: 3 };

const TETO: Record<RecoveryAuthority["status"], Intensidade> = {
  recuperado: "alta",
  leve: "moderada",
  cuidado: "leve",
  descanso: "descanso",
};

const STATUSES: RecoveryAuthority["status"][] = ["recuperado", "leve", "cuidado", "descanso"];

function sugerir(checkin: DailyCheckin, sessoes = HISTORICO): Sugestao {
  return sugerirTreinoDoDia({ sessoes, atividadesExtras: [], checkin, hoje: HOJE });
}

describe("consistência entre Recuperação e Sugestão de hoje", () => {
  it("nunca sugere treino quando a Recuperação manda descansar", () => {
    for (const checkin of [CHECKIN_OTIMO, CHECKIN_RUIM]) {
      const bruta = sugerir(checkin);
      const alinhada = alinharComRecuperacao(bruta, { status: "descanso", score: 22 });
      expect(alinhada.intensidade).toBe("descanso");
      expect(alinhada.tipo).toBe("descanso ativo");
      expect(alinhada.grupos).toEqual([]);
    }
  });

  it("respeita o teto de intensidade de cada status da Recuperação", () => {
    for (const status of STATUSES) {
      for (const checkin of [CHECKIN_OTIMO, CHECKIN_RUIM]) {
        const alinhada = alinharComRecuperacao(sugerir(checkin), { status, score: 50 });
        expect(RANK[alinhada.intensidade]).toBeLessThanOrEqual(RANK[TETO[status]]);
      }
    }
  });

  it("não promove intensidade quando a Recuperação está melhor que o check-in", () => {
    const bruta = sugerir(CHECKIN_RUIM);
    const alinhada = alinharComRecuperacao(bruta, { status: "recuperado", score: 92 });
    expect(RANK[alinhada.intensidade]).toBeLessThanOrEqual(RANK[bruta.intensidade]);
  });

  it("mantém a sugestão intacta quando não há dado de Recuperação", () => {
    const bruta = sugerir(CHECKIN_OTIMO);
    expect(alinharComRecuperacao(bruta, null)).toEqual(bruta);
    expect(alinharComRecuperacao(bruta, undefined)).toEqual(bruta);
  });

  it("cobre todas as faixas de score sem gerar recomendações opostas", () => {
    for (let score = 0; score <= 100; score += 5) {
      const status = scoreToStatus(score);
      const alinhada = alinharComRecuperacao(sugerir(CHECKIN_OTIMO), { status, score });
      const mandaDescansar = recuperacaoExigeDescanso({ status, score });
      if (mandaDescansar) {
        expect(alinhada.intensidade).toBe("descanso");
      } else {
        expect(alinhada.intensidade).not.toBe("descanso");
      }
      expect(RANK[alinhada.intensidade]).toBeLessThanOrEqual(RANK[TETO[status]]);
    }
  });

  it("score baixo (<40) sempre vira status de descanso na Recuperação", () => {
    expect(scoreToStatus(39)).toBe("descanso");
    expect(scoreToStatus(40)).toBe("cuidado");
    expect(scoreToStatus(60)).toBe("leve");
    expect(scoreToStatus(80)).toBe("recuperado");
  });
});

describe("hierarquia de check-in versus sleep_logs", () => {
  it("prioriza sleep_logs sobre daily_checkins no mesmo dia", () => {
    const unificado = unifySleepSources(
      [{ log_date: "2026-07-30", hours: 8, quality: 5 }],
      [{ log_date: "2026-07-30", sleep_hours: 4, sleep_quality: 1, soreness: 3, energy: 3 }],
    );
    expect(unificado).toHaveLength(1);
    expect(unificado[0].hours).toBe(8);
    expect(unificado[0].quality).toBe(5);
  });

  it("usa o check-in como fallback quando não há sleep_log do dia", () => {
    const unificado = unifySleepSources(
      [{ log_date: "2026-07-29", hours: 7, quality: 4 }],
      [{ log_date: "2026-07-30", sleep_hours: 5.5, sleep_quality: 2, soreness: 3, energy: 3 }],
    );
    expect(unificado.map((s) => s.log_date)).toEqual(["2026-07-30", "2026-07-29"]);
    expect(unificado[0].hours).toBe(5.5);
  });

  it("nunca duplica a mesma noite em duas fontes", () => {
    const unificado = unifySleepSources(
      [
        { log_date: "2026-07-30", hours: 8, quality: 5 },
        { log_date: "2026-07-29", hours: 7, quality: 4 },
      ],
      [
        { log_date: "2026-07-30", sleep_hours: 4, sleep_quality: 1, soreness: 4, energy: 2 },
        { log_date: "2026-07-29", sleep_hours: 6, sleep_quality: 3, soreness: 2, energy: 3 },
      ],
    );
    expect(new Set(unificado.map((s) => s.log_date)).size).toBe(unificado.length);
  });

  it("sono ruim no check-in derruba a sugestão para descanso ativo", () => {
    const s = sugerir(CHECKIN_RUIM);
    expect(s.intensidade).toBe("descanso");
    expect(s.score).toBeLessThanOrEqual(4);
  });
});

describe("limiares por grupo muscular", () => {
  it("cada grupo só é liberado após seu próprio limiar", () => {
    for (const g of MUSCLE_GROUPS) {
      const limiar = MUSCLE_RECOVERY_DAYS[g];
      expect(isMuscleRecovered(g, limiar - 0.01)).toBe(false);
      expect(isMuscleRecovered(g, limiar)).toBe(true);
    }
  });

  it("pernas exigem mais descanso que abdômen", () => {
    expect(MUSCLE_RECOVERY_DAYS.pernas).toBeGreaterThan(MUSCLE_RECOVERY_DAYS.abdomen);
    expect(isMuscleRecovered("pernas", 2)).toBe(false);
    expect(isMuscleRecovered("abdomen", 2)).toBe(true);
  });

  it("normaliza variações de nome vindas do banco", () => {
    expect(normalizeMuscleGroup("Panturrilha")).toBe("pernas");
    expect(normalizeMuscleGroup("Panturrilhas")).toBe("pernas");
    expect(normalizeMuscleGroup("Antebraço")).toBe("antebraco");
    expect(normalizeMuscleGroup("Core")).toBe("abdomen");
  });

  it("não sugere grupo treinado dentro do limiar de recuperação", () => {
    // Pernas treinadas ontem (limiar 3 dias) não podem aparecer como liberadas.
    const s = sugerirTreinoDoDia({
      sessoes: [sessao(1, ["Pernas"]), sessao(4, ["Peito"]), sessao(6, ["Costas"])],
      atividadesExtras: [],
      checkin: CHECKIN_OTIMO,
      hoje: HOJE,
    });
    expect(s.gruposLiberados.some((l) => l.grupo === "pernas")).toBe(false);
    expect(s.grupos).not.toContain("pernas");
  });
});
