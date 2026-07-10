// Cálculo determinístico da fase do ciclo menstrual.
// Sem side-effects — usado em cliente e servidor.

export type CyclePhase = "menstrual" | "folicular" | "ovulacao" | "lutea";

export type CycleInfo = {
  phase: CyclePhase;
  phaseLabel: string;
  dayInCycle: number;      // 1..cycleLength
  cycleLength: number;
  periodLength: number;
  daysUntilNextPeriod: number;
  recommendation: string;
  headline: string;
  // fator para ajuste de carga/descanso (usado pelo coach de recuperação)
  loadMultiplier: number;   // 1.0 = sem ajuste; <1 = reduzir carga
  restBonusSeconds: number; // segundos extras de descanso sugeridos
  isLatePhaseLutea: boolean;
};

export type CycleInput = {
  lastPeriodStart: string | Date | null | undefined;
  cycleLength?: number | null;
  periodLength?: number | null;
  today?: Date;
};

const PHASE_LABEL: Record<CyclePhase, string> = {
  menstrual: "Menstrual",
  folicular: "Folicular",
  ovulacao: "Ovulação",
  lutea: "Lútea",
};

const RECOMMENDATIONS: Record<CyclePhase, { headline: string; recommendation: string }> = {
  menstrual: {
    headline: "Fase menstrual · energia mais baixa",
    recommendation:
      "Priorize treino leve a moderado, mobilidade e técnica. Reduza carga em ~10-20% se houver cólica ou cansaço.",
  },
  folicular: {
    headline: "Fase folicular · pique alto",
    recommendation:
      "Maior disposição e recuperação — bom momento pra treinos intensos e progredir carga.",
  },
  ovulacao: {
    headline: "Ovulação · pico de força",
    recommendation:
      "Pode testar cargas mais altas. Atenção à estabilidade articular e ao aquecimento.",
  },
  lutea: {
    headline: "Fase lútea · sustente o volume",
    recommendation:
      "Energia tende a cair perto do fim da fase. Priorize volume moderado e mais descanso entre séries.",
  },
};

function toDateOnly(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function computeCyclePhase(input: CycleInput): CycleInfo | null {
  if (!input.lastPeriodStart) return null;
  const cycleLength = Math.max(20, Math.min(45, Number(input.cycleLength) || 28));
  const periodLength = Math.max(2, Math.min(10, Number(input.periodLength) || 5));
  const today = toDateOnly(input.today ?? new Date());
  const start = toDateOnly(new Date(input.lastPeriodStart));
  if (isNaN(start.getTime())) return null;

  const diffDays = Math.floor((today.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
  if (diffDays < 0) return null;

  // dia dentro do ciclo atual (1..cycleLength)
  const dayInCycle = (diffDays % cycleLength) + 1;

  // fases (aproximação clínica padrão):
  // 1..periodLength → menstrual
  // periodLength+1 .. ovulationDay-2 → folicular
  // ovulationDay-1 .. ovulationDay+1 → ovulação (janela de 3 dias)
  // resto → lútea
  const ovulationDay = cycleLength - 14; // ~14 dias antes do próximo ciclo
  let phase: CyclePhase;
  if (dayInCycle <= periodLength) phase = "menstrual";
  else if (dayInCycle < ovulationDay - 1) phase = "folicular";
  else if (dayInCycle <= ovulationDay + 1) phase = "ovulacao";
  else phase = "lutea";

  const daysUntilNextPeriod = cycleLength - dayInCycle + 1;
  const rec = RECOMMENDATIONS[phase];

  // Ajuste para o coach de recuperação:
  // - Menstrual: -10% carga, +15s descanso
  // - Últimos 3 dias da lútea (TPM): -10% carga, +15s descanso
  // - Ovulação: sem penalidade (mantém 1.0)
  // - Folicular: sem penalidade
  const isLatePhaseLutea = phase === "lutea" && daysUntilNextPeriod <= 3;
  let loadMultiplier = 1.0;
  let restBonusSeconds = 0;
  if (phase === "menstrual" || isLatePhaseLutea) {
    loadMultiplier = 0.9;
    restBonusSeconds = 15;
  }

  return {
    phase,
    phaseLabel: PHASE_LABEL[phase],
    dayInCycle,
    cycleLength,
    periodLength,
    daysUntilNextPeriod,
    headline: rec.headline,
    recommendation: rec.recommendation,
    loadMultiplier,
    restBonusSeconds,
    isLatePhaseLutea,
  };
}
