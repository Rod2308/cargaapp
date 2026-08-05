// Sugestão de treino do dia — lógica 100% local, determinística.
// Zero chamadas externas. Testável.
//
// A recuperação muscular (limiares por grupo + cálculo em dias fracionados)
// vive em `src/lib/muscle-recovery.ts` — fonte única compartilhada com o
// motor de Recuperação (`recovery-core.ts`).

import { localDateStr, localDayStart, localDaysBetween, weekStart } from "./week";
import {
  MUSCLE_GROUPS,
  MUSCLE_LABEL,
  MUSCLE_RECOVERY_DAYS,
  fractionalDaysSince,
  normalizeMuscleGroup,
  type MuscleGroup,
} from "./muscle-recovery";
import type { RecoveryAdvice } from "./recovery-core";

export type { MuscleGroup };
export { MUSCLE_GROUPS, MUSCLE_LABEL, MUSCLE_RECOVERY_DAYS, normalizeMuscleGroup };

export type Impact = "alto" | "medio" | "baixo";

export const ACTIVITY_IMPACT_MAP: Record<
  string,
  { muscles: Partial<Record<MuscleGroup, Impact>>; cardio: Impact }
> = {
  futebol: { muscles: { pernas: "alto", gluteo: "medio" }, cardio: "alto" },
  volei: { muscles: { pernas: "medio", ombro: "medio" }, cardio: "medio" },
  corrida: { muscles: { pernas: "alto", gluteo: "medio" }, cardio: "alto" },
  caminhada: { muscles: { pernas: "baixo" }, cardio: "baixo" },
  natacao: { muscles: { ombro: "medio", costas: "medio" }, cardio: "alto" },
  ciclismo: { muscles: { pernas: "medio", gluteo: "medio" }, cardio: "alto" },
  basquete: { muscles: { pernas: "alto", gluteo: "medio" }, cardio: "alto" },
  tenis: { muscles: { pernas: "medio", ombro: "medio" }, cardio: "medio" },
  boxe: { muscles: { ombro: "alto", triceps: "medio", abdomen: "medio" }, cardio: "alto" },
  crossfit: { muscles: { pernas: "alto", ombro: "medio", costas: "medio" }, cardio: "alto" },
  yoga: { muscles: {}, cardio: "baixo" },
  pilates: { muscles: { abdomen: "medio" }, cardio: "baixo" },
};

export function normalizeActivityName(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const s = raw
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  for (const key of Object.keys(ACTIVITY_IMPACT_MAP)) {
    if (s.includes(key)) return key;
  }
  if (/futebol|society|fut\b|soccer|football/.test(s)) return "futebol";
  if (/corr(er|ida)|running|\brun\b|jog/.test(s)) return "corrida";
  if (/nata|swim/.test(s)) return "natacao";
  if (/bike|biking|ciclism|cycling|pedal|\bride\b/.test(s)) return "ciclismo";
  if (/caminha|walk|hik|trilha/.test(s)) return "caminhada";
  if (/volei|volley/.test(s)) return "volei";
  if (/basquete|basket/.test(s)) return "basquete";
  if (/tenis|tennis/.test(s)) return "tenis";
  if (/cardio|hiit|elipt|elliptical|rem(o|ar)|row/.test(s)) return "corrida";
  return null;
}

export type TimelineEntry = {
  date: string;
  at?: string;
  source: "workout" | "extra";
  label: string;
  impact: Partial<Record<MuscleGroup, Impact>>;
  cardio: Impact | null;
  durationMin: number;
  slug?: string | null;
};

export type WorkoutSession = {
  started_at: string;
  ended_at: string | null;
  workout_label?: string | null;
  workout_name?: string | null;
  muscle_groups: string[];
};

export type ExtraActivity = {
  started_at: string;
  ended_at: string | null;
  activity_name: string;
  duration_min: number | null;
};

function toDateStr(iso: string, tz?: string | null): string {
  return localDateStr(iso, tz);
}

export function combineTimeline(
  sessoes: WorkoutSession[],
  atividadesExtras: ExtraActivity[],
  now: Date = new Date(),
  tz?: string | null,
): TimelineEntry[] {
  const rolling = new Date(now.getTime() - 7 * 86400_000);
  const ws = weekStart(now, tz);
  const sevenAgo = ws < rolling ? ws : rolling;
  const out: TimelineEntry[] = [];

  for (const s of sessoes) {
    const started = new Date(s.started_at);
    if (started < sevenAgo) continue;
    const impact: Partial<Record<MuscleGroup, Impact>> = {};
    for (const g of s.muscle_groups) {
      const mg = normalizeMuscleGroup(g);
      if (mg) impact[mg] = "alto";
    }
    const dur = s.ended_at
      ? Math.max(0, (new Date(s.ended_at).getTime() - started.getTime()) / 60000)
      : 45;
    out.push({
      date: toDateStr(s.started_at, tz),
      at: s.started_at,
      source: "workout",
      label: s.workout_label ? `Treino ${s.workout_label}` : s.workout_name ?? "Treino",
      impact,
      cardio: null,
      durationMin: dur,
    });
  }

  for (const a of atividadesExtras) {
    const started = new Date(a.started_at);
    if (started < sevenAgo) continue;
    const slug = normalizeActivityName(a.activity_name);
    const map = slug ? ACTIVITY_IMPACT_MAP[slug] : null;
    const dur =
      a.duration_min ??
      (a.ended_at ? Math.max(0, (new Date(a.ended_at).getTime() - started.getTime()) / 60000) : 30);
    out.push({
      date: toDateStr(a.started_at, tz),
      at: a.started_at,
      source: "extra",
      label: a.activity_name,
      impact: map?.muscles ?? {},
      cardio: map?.cardio ?? "baixo",
      durationMin: dur,
      slug,
    });
  }

  out.sort((a, b) => (a.date < b.date ? 1 : -1));
  return out;
}

export function diasDesdeUltimoEsforco(
  timeline: TimelineEntry[],
  grupo: MuscleGroup,
  now: Date = new Date(),
): number {
  let best: number | null = null;
  for (const e of timeline) {
    const impact = e.impact[grupo];
    if (impact === "alto" || impact === "medio") {
      const diff = Math.max(0, fractionalDaysSince(e.at ?? `${e.date}T12:00:00.000Z`, now));
      if (best == null || diff < best) best = diff;
    }
  }
  return best == null ? Number.POSITIVE_INFINITY : best;
}

export function formatDias(d: number): string {
  if (!Number.isFinite(d)) return "—";
  return d >= 10 ? String(Math.round(d)) : d.toFixed(1).replace(".", ",");
}


export function gruposLiberados(
  timeline: TimelineEntry[],
  now: Date = new Date(),
): { grupo: MuscleGroup; diasParado: number }[] {
  return MUSCLE_GROUPS.map((g) => ({ grupo: g, diasParado: diasDesdeUltimoEsforco(timeline, g, now) }))
    .filter((x) => x.diasParado >= MUSCLE_RECOVERY_DAYS[x.grupo])
    .sort((a, b) => b.diasParado - a.diasParado);
}

export type CardioCarga = {
  minutos: number;
  sessoes: number;
  sessoesIntensas: number;
  duplicadasIgnoradas: number;
  nivel: "baixa" | "media" | "alta";
};

const MAX_MIN_POR_SESSAO = 300;
const DEDUPE_MIN = 30;

function entryStart(e: TimelineEntry): number {
  return new Date(e.at ?? `${e.date}T12:00:00.000Z`).getTime();
}

export function cargaCardioSemana(
  timeline: TimelineEntry[],
  now: Date = new Date(),
  tz?: string | null,
): CardioCarga {
  const inicioSemana = weekStart(now, tz).getTime();
  const fim = now.getTime();

  const candidatas = timeline
    .filter((e) => e.cardio === "alto" || e.cardio === "medio")
    .map((e) => ({ e, t: entryStart(e) }))
    .filter((x) => x.t >= inicioSemana && x.t <= fim)
    .sort((a, b) => a.t - b.t);

  const mantidas: { e: TimelineEntry; t: number }[] = [];
  let duplicadas = 0;

  for (const c of candidatas) {
    const chave = c.e.slug ?? c.e.label.trim().toLowerCase();
    const dup = mantidas.some((m) => {
      const mChave = m.e.slug ?? m.e.label.trim().toLowerCase();
      return mChave === chave && Math.abs(m.t - c.t) <= DEDUPE_MIN * 60_000;
    });
    if (dup) {
      duplicadas += 1;
      continue;
    }
    mantidas.push(c);
  }

  let minutos = 0;
  let intensas = 0;
  for (const { e } of mantidas) {
    minutos += Math.min(Math.max(0, e.durationMin), MAX_MIN_POR_SESSAO);
    if (e.cardio === "alto") intensas += 1;
  }

  const nivel: CardioCarga["nivel"] = intensas >= 3 ? "alta" : intensas >= 1 ? "media" : "baixa";
  return {
    minutos: Math.round(minutos),
    sessoes: mantidas.length,
    sessoesIntensas: intensas,
    duplicadasIgnoradas: duplicadas,
    nivel,
  };
}

export type Intensidade = "leve" | "moderada" | "alta" | "descanso";
export type TipoTreino = "descanso ativo" | "funcional leve" | "força" | "cardio leve" | "mobilidade" | "full body";

export type Sugestao = {
  tipo: TipoTreino;
  grupos: MuscleGroup[];
  intensidade: Intensidade;
  motivo: string;
  score: number;
  scoreDetalhe: string;
  gruposLiberados: { grupo: MuscleGroup; diasParado: number }[];
  cardio: CardioCarga;
  temPoucoHistorico: boolean;
  diasEsforcoSemana: number;
};

const UPPER_BODY: MuscleGroup[] = ["peito", "costas", "ombro", "biceps", "triceps"];

function joinGrupos(gs: MuscleGroup[]): string {
  const labels = gs.map((g) => MUSCLE_LABEL[g]);
  if (labels.length <= 1) return labels.join("");
  if (labels.length === 2) return `${labels[0]} e ${labels[1]}`;
  return `${labels.slice(0, -1).join(", ")} e ${labels[labels.length - 1]}`;
}

export function sugerirTreinoDoDia(args: {
  sessoes: WorkoutSession[];
  atividadesExtras: ExtraActivity[];
  recovery: Pick<RecoveryAdvice, "score" | "status"> | null;
  hoje?: Date;
  tz?: string | null;
}): Sugestao {
  const now = args.hoje ?? new Date();
  const tz = args.tz;
  const timeline = combineTimeline(args.sessoes, args.atividadesExtras, now, tz);
  const liberados = gruposLiberados(timeline, now);
  const cardio = cargaCardioSemana(timeline, now, tz);
  const diasComEsforco = new Set(timeline.map((e) => e.date)).size;
  const temPoucoHistorico = args.sessoes.length + args.atividadesExtras.length < 3;

  const status = args.recovery?.status ?? "cuidado";
  const score = args.recovery?.score ?? 50;
  const scoreDetalhe = `Score da Recuperação: ${score.toFixed(1)}/100`;

  if (status === "descanso") {
    return {
      tipo: "descanso ativo",
      grupos: [],
      intensidade: "descanso",
      motivo: `Hoje é dia de aliviar — seu corpo pediu descanso (Score ${score}/100). Faça mobilidade, alongamento ou uma caminhada leve.`,
      score,
      scoreDetalhe,
      gruposLiberados: liberados,
      cardio,
      temPoucoHistorico,
      diasEsforcoSemana: diasComEsforco,
    };
  }

  const pernasExigidas = timeline.some((e) => {
    if (e.source !== "extra") return false;
    const dias = localDaysBetween(now, localDayStart(e.date, tz), tz);
    return dias <= 2 && (e.impact.pernas === "alto" || e.impact.pernas === "medio");
  });

  if (temPoucoHistorico) {
    return {
      tipo: "full body",
      grupos: ["peito", "costas", "pernas"],
      intensidade: status === "recuperado" ? "moderada" : "leve",
      motivo:
        "Poucos dados ainda. Comece com um full body leve/moderado — as sugestões vão melhorar conforme você registrar treinos e atividades.",
      score,
      scoreDetalhe,
      gruposLiberados: liberados,
      cardio,
      temPoucoHistorico,
      diasEsforcoSemana: diasComEsforco,
    };
  }

  if (status === "cuidado") {
    const candidato = liberados.find((l) => {
      const impactoRecente = timeline.some(
        (e) =>
          e.source === "extra" &&
          localDaysBetween(now, localDayStart(e.date, tz), tz) <= 2 &&
          (e.impact[l.grupo] === "alto" || e.impact[l.grupo] === "medio"),
      );
      return !impactoRecente;
    });
    const grupo = candidato?.grupo ?? liberados[0]?.grupo;
    if (grupo) {
      return {
        tipo: "funcional leve",
        grupos: [grupo],
        intensidade: "leve",
        motivo: `Corpo fadigado (Score ${score}/100). Um funcional leve em ${MUSCLE_LABEL[grupo]} mantém o ritmo sem sobrecarregar.`,
        score,
        scoreDetalhe,
        gruposLiberados: liberados,
        cardio,
        temPoucoHistorico,
        diasEsforcoSemana: diasComEsforco,
      };
    }
  }

  if ((status === "leve" || status === "recuperado") && liberados.length > 0) {
    let candidatos = liberados;
    let motivoExtra = "";
    if (pernasExigidas) {
      candidatos = liberados.filter((l) => l.grupo !== "pernas" && l.grupo !== "gluteo");
      const extra = timeline.find(
        (e) => e.source === "extra" && (e.impact.pernas === "alto" || e.impact.pernas === "medio"),
      );
      if (extra) {
        const dias = localDaysBetween(now, localDayStart(extra.date, tz), tz);
        motivoExtra = ` (Pernas poupadas pelo ${extra.label.toLowerCase()} de ${dias === 0 ? "hoje" : dias === 1 ? "ontem" : `há ${dias} dias`}).`;
      }
    }
    if (cardio.nivel === "alta" && candidatos.some((c) => c.grupo === "pernas")) {
      candidatos = candidatos.filter((l) => l.grupo !== "pernas");
      motivoExtra += " (Pernas poupadas pelo cardio alto).";
    }
    const escolhido = candidatos[0] ?? liberados[0];
    if (escolhido) {
      const grupos: MuscleGroup[] = [escolhido.grupo];
      if (escolhido.grupo === "peito") grupos.push("triceps");
      else if (escolhido.grupo === "costas") grupos.push("biceps");
      else if (escolhido.grupo === "ombro") grupos.push("triceps");
      else if (escolhido.grupo === "pernas") grupos.push("gluteo");

      const grupoLabel = joinGrupos(grupos);
      const intensidade: Intensidade = status === "recuperado" ? "alta" : "moderada";
      return {
        tipo: "força",
        grupos,
        intensidade,
        motivo: `Treino de força focado em ${grupoLabel}${motivoExtra}`,
        score,
        scoreDetalhe,
        gruposLiberados: liberados,
        cardio,
        temPoucoHistorico,
        diasEsforcoSemana: diasComEsforco,
      };
    }
  }

  if (liberados.length === 0 && (status === "leve" || status === "recuperado")) {
    if (cardio.nivel === "alta") {
      return {
        tipo: "mobilidade",
        grupos: [],
        intensidade: "leve",
        motivo: "Cardio semanal alto e músculos ainda em recuperação. Hoje o ideal é alongamento/mobilidade.",
        score,
        scoreDetalhe,
        gruposLiberados: liberados,
        cardio,
        temPoucoHistorico,
        diasEsforcoSemana: diasComEsforco,
      };
    }
    return {
      tipo: "cardio leve",
      grupos: [],
      intensidade: "leve",
      motivo: "Músculos em recuperação. Uma caminhada ou pedalada leve mantém a atividade diária.",
      score,
      scoreDetalhe,
      gruposLiberados: liberados,
      cardio,
      temPoucoHistorico,
      diasEsforcoSemana: diasComEsforco,
    };
  }

  return {
    tipo: "full body",
    grupos: UPPER_BODY.slice(0, 3),
    intensidade: "leve",
    motivo: `Score ${score.toFixed(1)}/100. Um treino leve de parte superior mantém o ritmo.`,
    score,
    scoreDetalhe,
    gruposLiberados: liberados,
    cardio,
    temPoucoHistorico,
    diasEsforcoSemana: diasComEsforco,
  };
}

export function melhorWorkoutParaSugestao(
  workouts: { id: string; label: string; name: string; muscle_groups: string[] }[],
  grupos: MuscleGroup[],
): string | null {
  if (!workouts.length || !grupos.length) return null;
  let best: { id: string; score: number } | null = null;
  for (const w of workouts) {
    const groupsNorm = new Set(
      w.muscle_groups.map(normalizeMuscleGroup).filter((g): g is MuscleGroup => !!g),
    );
    const score = grupos.reduce((acc, g) => acc + (groupsNorm.has(g) ? 1 : 0), 0);
    if (!best || score > best.score) best = { id: w.id, score };
  }
  return best && best.score > 0 ? best.id : null;
}

export type PlanoWorkout = {
  id: string;
  label: string | null;
  name: string;
};

export type SugestaoPlano = {
  sugestao: Sugestao;
  workoutId: string;
  workoutLabel: string;
  workoutName: string;
};

export function gruposDoWorkoutNome(label: string, name: string): MuscleGroup[] {
  const hay = `${label} ${name}`.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const out: MuscleGroup[] = [];
  if (/peito|chest/.test(hay)) out.push("peito");
  if (/costa|dorsal|back|puxada/.test(hay)) out.push("costas");
  if (/perna|quad|leg|posterior|panturr/.test(hay)) out.push("pernas");
  if (/ombro|shoulder|delto/.test(hay)) out.push("ombro");
  if (/bicep/.test(hay)) out.push("biceps");
  if (/tricep/.test(hay)) out.push("triceps");
  if (/gluteo/.test(hay)) out.push("gluteo");
  if (/abdom|core|abs/.test(hay)) out.push("abdomen");
  if (/upper|superior|push|pull/.test(hay)) out.push("peito", "costas", "ombro");
  if (/lower|inferior/.test(hay)) out.push("pernas", "gluteo");
  return Array.from(new Set(out));
}

export function sugerirTreinoDoPlano(args: {
  workouts: PlanoWorkout[];
  sessoes: WorkoutSession[];
  atividadesExtras: ExtraActivity[];
  recovery: Pick<RecoveryAdvice, "score" | "status"> | null;
  hoje?: Date;
  tz?: string | null;
}): SugestaoPlano | null {
  const plano = args.workouts
    .filter((w) => w.label && /^[A-Z]$/i.test(w.label.trim()))
    .map((w) => ({ ...w, label: w.label!.trim().toUpperCase() }))
    .sort((a, b) => a.label.localeCompare(b.label));

  if (plano.length < 2) return null;

  const now = args.hoje ?? new Date();
  const tz = args.tz;
  const timeline = combineTimeline(args.sessoes, args.atividadesExtras, now, tz);
  const cardio = cargaCardioSemana(timeline, now, tz);
  
  const status = args.recovery?.status ?? "cuidado";
  const score = args.recovery?.score ?? 50;
  const diasComEsforco = new Set(timeline.map((e) => e.date)).size;
  const liberados = gruposLiberados(timeline, now);
  const scoreDetalhe = `Score da Recuperação: ${score.toFixed(1)}/100`;

  if (status === "descanso") {
    return null; 
  }

  const inicioSemana = weekStart(now, tz).getTime();
  const feitosEssaSemana = new Set(
    args.sessoes
      .filter((s) => new Date(s.started_at).getTime() >= inicioSemana)
      .map((s) => s.workout_label?.trim().toUpperCase())
      .filter(Boolean)
  );

  const ordenadas = [...args.sessoes].sort((a, b) => (a.started_at < b.started_at ? 1 : -1));
  let ultimoIdx = -1;
  let ultimaLabel: string | null = null;
  for (const s of ordenadas) {
    const l = s.workout_label?.trim().toUpperCase();
    if (!l) continue;
    const idx = plano.findIndex((p) => p.label === l);
    if (idx >= 0) {
      ultimoIdx = idx;
      ultimaLabel = l;
      break;
    }
  }

  const rotacaoCompleta = plano.map((_, i) =>
    plano[((ultimoIdx < 0 ? -1 : ultimoIdx) + 1 + i) % plano.length],
  );
  
  let rotacao = rotacaoCompleta.filter((p) => !feitosEssaSemana.has(p.label));
  if (rotacao.length === 0) {
    rotacao = rotacaoCompleta;
  }
  let melhor: { w: PlanoWorkout & { label: string }; score: number } | null = null;
  rotacao.forEach((w, pos) => {
    const gs = gruposDoWorkoutNome(w.label, w.name);
    const descansos = gs.map((g) => diasDesdeUltimoEsforco(timeline, g, now));
    const minDescanso = descansos.length ? Math.min(...descansos) : Number.POSITIVE_INFINITY;
    const recuperado = gs.every((g, i) => descansos[i] >= MUSCLE_RECOVERY_DAYS[g]);
    const scoreCalc =
      (recuperado ? 1000 : 0) +
      Math.min(Number.isFinite(minDescanso) ? minDescanso : 30, 30) -
      pos * 0.01;
    if (!melhor || scoreCalc > melhor.score) melhor = { w, score: scoreCalc };
  });
  const proximo = (melhor as { w: PlanoWorkout & { label: string } } | null)?.w ?? rotacao[0];
  const proximoIdx = plano.findIndex((p) => p.id === proximo.id);

  const pernasImpactadas = timeline.some((e) => {
    if (e.source !== "extra") return false;
    const dias = Math.floor((now.getTime() - new Date(e.date).getTime()) / 86400_000);
    return dias <= 2 && (e.impact.pernas === "alto" || e.impact.pernas === "medio");
  });
  let escolhido = proximo;
  let motivoExtra = "";
  const gruposProx = gruposDoWorkoutNome(proximo.label, proximo.name);
  if (pernasImpactadas && gruposProx.includes("pernas")) {
    const alt = plano.find((p, i) => {
      if (i === proximoIdx) return false;
      const g = gruposDoWorkoutNome(p.label, p.name);
      return g.length > 0 && !g.includes("pernas");
    });
    if (alt) {
      escolhido = alt;
      const extra = timeline.find(
        (e) => e.source === "extra" && (e.impact.pernas === "alto" || e.impact.pernas === "medio"),
      );
      motivoExtra = extra
        ? ` Pulei o treino de pernas do plano devido ao ${extra.label.toLowerCase()} recente.`
        : "";
    }
  }

  const gruposNaoRecuperados = (gs: MuscleGroup[]) =>
    gs.filter((g) => diasDesdeUltimoEsforco(timeline, g, now) < MUSCLE_RECOVERY_DAYS[g]);

  let gruposEscolhidoAtual = gruposDoWorkoutNome(escolhido.label, escolhido.name);
  let pendentes = gruposNaoRecuperados(gruposEscolhidoAtual);
  let motivoRecuperacao = "";
  if (pendentes.length > 0) {
    const escolhidoIdx = plano.findIndex((p) => p.id === escolhido.id);
    for (let step = 1; step < plano.length; step++) {
      const cand = plano[(escolhidoIdx + step) % plano.length];
      const gs = gruposDoWorkoutNome(cand.label, cand.name);
      if (gs.length === 0) continue;
      if (pernasImpactadas && gs.includes("pernas")) continue;
      if (gruposNaoRecuperados(gs).length === 0) {
        const pulados = pendentes.map((g) => MUSCLE_LABEL[g].toLowerCase()).join(", ");
        motivoRecuperacao = ` O treino ${escolhido.label} foi adiado porque: ${pulados} em recuperação.`;
        escolhido = cand;
        gruposEscolhidoAtual = gs;
        pendentes = [];
        break;
      }
    }
  }

  const gruposEscolhido = gruposEscolhidoAtual;
  const intensidade: Intensidade = status === "recuperado" ? "alta" : status === "cuidado" ? "leve" : "moderada";
  const motivo = ultimaLabel
    ? `Sequência: Hoje é o ${escolhido.label} — ${escolhido.name}.${motivoExtra}${motivoRecuperacao}`
    : `Iniciando: Hoje é o ${escolhido.label} — ${escolhido.name}.${motivoExtra}${motivoRecuperacao}`;

  return {
    workoutId: escolhido.id,
    workoutLabel: escolhido.label,
    workoutName: escolhido.name,
    sugestao: {
      tipo: "força",
      grupos: gruposEscolhido.length > 0 ? gruposEscolhido : ["peito", "costas"],
      intensidade,
      motivo,
      score,
      scoreDetalhe,
      gruposLiberados: liberados,
      cardio,
      temPoucoHistorico: false,
      diasEsforcoSemana: diasComEsforco,
    },
  };
}

export type RotinaWorkout = { id: string; label: string | null; name: string };

export function ordenarRotina<T extends RotinaWorkout>(workouts: T[]): T[] {
  const comLetra = workouts.filter((w) => w.label && /^[A-Z]$/i.test(String(w.label).trim()));
  if (comLetra.length >= 2) {
    return [...comLetra].sort((a, b) =>
      String(a.label).trim().toUpperCase().localeCompare(String(b.label).trim().toUpperCase()),
    );
  }
  return workouts;
}

export function proximoNaRotina<T extends RotinaWorkout>(
  workouts: T[],
  ultimoWorkoutId: string | null | undefined,
): T | null {
  const rotina = ordenarRotina(workouts);
  if (rotina.length === 0) return null;
  if (!ultimoWorkoutId) return rotina[0];
  const idx = rotina.findIndex((w) => w.id === ultimoWorkoutId);
  if (idx < 0) return rotina[0];
  return rotina[(idx + 1) % rotina.length];
}

export function proximoNaRotinaComRecuperacao<T extends RotinaWorkout>(
  workouts: T[],
  ultimoWorkoutId: string | null | undefined,
  timeline: TimelineEntry[],
  now: Date = new Date(),
): T | null {
  const rotina = ordenarRotina(workouts);
  if (rotina.length === 0) return null;
  
  const inicioSemana = weekStart(now).getTime();
  const feitosEssaSemana = new Set(
    timeline
      .filter((e) => e.source === "workout" && new Date(e.at ?? `${e.date}T12:00:00Z`).getTime() >= inicioSemana)
      .map((e) => {
        const m = String(e.label).match(/Treino\s+([A-Z])/i);
        return m ? m[1].toUpperCase() : String(e.label).trim().toUpperCase();
      })
      .filter(Boolean)
  );

  const idx = ultimoWorkoutId ? rotina.findIndex((w) => w.id === ultimoWorkoutId) : -1;
  const rotacaoCompleta = rotina.map((_, pos) => rotina[(idx + 1 + pos) % rotina.length]);
  
  let rotacaoDisponivel = rotacaoCompleta.filter(w => !feitosEssaSemana.has(String(w.label).trim().toUpperCase()));
  if (rotacaoDisponivel.length === 0) {
    rotacaoDisponivel = rotacaoCompleta;
  }

  if (timeline.length === 0) return rotacaoDisponivel[0];

  let best: { w: T; score: number } | undefined = undefined;
  for (let i = 0; i < rotacaoDisponivel.length; i++) {
    const w = rotacaoDisponivel[i];
    const gs = gruposDoWorkoutNome(String(w.label ?? ""), w.name);
    const descansos = gs.map((g) => diasDesdeUltimoEsforco(timeline, g, now));
    const minDescanso = descansos.length ? Math.min(...descansos) : Number.POSITIVE_INFINITY;
    const recuperado = gs.every((g, j) => descansos[j] >= MUSCLE_RECOVERY_DAYS[g]);
    const score =
      (recuperado ? 1000 : 0) +
      Math.min(Number.isFinite(minDescanso) ? minDescanso : 30, 30) -
      i * 0.01;
    if (!best || score > best.score) best = { w, score };
  }
  return best ? (best.w as T) : rotacaoDisponivel[0];
}

export type RecoveryAuthority = {
  status: "recuperado" | "leve" | "cuidado" | "descanso";
  score: number;
  intensityLabel?: string;
};

export function recuperacaoExigeDescanso(rec: Pick<RecoveryAuthority, "status"> | null | undefined): boolean {
  return !!rec && rec.status === "descanso";
}
