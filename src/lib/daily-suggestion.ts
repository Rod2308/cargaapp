// Sugestão de treino do dia — lógica 100% local, determinística.
// Zero chamadas externas. Testável.
//
// A recuperação muscular (limiares por grupo + cálculo em dias fracionados)
// vive em `src/lib/muscle-recovery.ts` — fonte única compartilhada com o
// motor de Recuperação (`recovery-core.ts`).

import {
  MUSCLE_GROUPS,
  MUSCLE_LABEL,
  MUSCLE_RECOVERY_DAYS,
  fractionalDaysSince,
  normalizeMuscleGroup,
  type MuscleGroup,
} from "./muscle-recovery";

export type { MuscleGroup };
export { MUSCLE_GROUPS, MUSCLE_LABEL, MUSCLE_RECOVERY_DAYS, normalizeMuscleGroup };


export type Impact = "alto" | "medio" | "baixo";

// Mapa de esportes/atividades extras → impacto por grupo muscular.
// Também marca se há componente cardio (alto/medio/baixo).
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

// Normaliza um nome livre de atividade (ex: "Futebol Society") ao slug do mapa.
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
  date: string; // yyyy-mm-dd
  at?: string; // timestamp ISO do início (usado p/ dias fracionados)
  source: "workout" | "extra";
  label: string; // nome do treino ou da atividade extra
  impact: Partial<Record<MuscleGroup, Impact>>;
  cardio: Impact | null;
  durationMin: number;

};

export type WorkoutSession = {
  started_at: string;
  ended_at: string | null;
  workout_label?: string | null;
  workout_name?: string | null;
  muscle_groups: string[]; // grupos livres vindos de exercises.muscle_group
};

export type ExtraActivity = {
  started_at: string;
  ended_at: string | null;
  activity_name: string;
  duration_min: number | null;
};

export type DailyCheckin = {
  sleep_hours: number;
  sleep_quality: number; // 1-5
  soreness: number; // 1-5
  energy: number; // 1-5
};

function toDateStr(iso: string): string {
  return new Date(iso).toISOString().slice(0, 10);
}

function daysBetween(a: Date, b: Date): number {
  const ms = a.getTime() - b.getTime();
  return Math.floor(ms / 86400_000);
}

export function combineTimeline(
  sessoes: WorkoutSession[],
  atividadesExtras: ExtraActivity[],
  now: Date = new Date(),
): TimelineEntry[] {
  const sevenAgo = new Date(now.getTime() - 7 * 86400_000);
  const out: TimelineEntry[] = [];

  for (const s of sessoes) {
    const started = new Date(s.started_at);
    if (started < sevenAgo) continue;
    const impact: Partial<Record<MuscleGroup, Impact>> = {};
    for (const g of s.muscle_groups) {
      const mg = normalizeMuscleGroup(g);
      if (mg) impact[mg] = "alto"; // treino formal conta como alto
    }
    const dur = s.ended_at
      ? Math.max(0, (new Date(s.ended_at).getTime() - started.getTime()) / 60000)
      : 45;
    out.push({
      date: toDateStr(s.started_at),
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
      date: toDateStr(a.started_at),
      at: a.started_at,
      source: "extra",
      label: a.activity_name,
      impact: map?.muscles ?? {},
      cardio: map?.cardio ?? "baixo",
      durationMin: dur,
    });
  }

  out.sort((a, b) => (a.date < b.date ? 1 : -1));
  return out;
}

/**
 * Dias (fracionados) desde o último esforço de impacto médio/alto num grupo.
 * Usa `fractionalDaysSince` — mesma matemática do motor de Recuperação.
 * Infinity quando nunca houve estímulo na janela.
 */
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

/** Formata dias fracionados para exibição (ex.: 2.4d → "2,4"). */
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
  sessoesIntensas: number;
  nivel: "baixa" | "media" | "alta";
  /** Total de sessões de cardio contadas na semana (leves incluídas). */
  sessoes: number;
  /** Domingo (YYYY-MM-DD) que inicia a janela contada. */
  desde: string;
};

/**
 * Carga de cardio da SEMANA CORRENTE (domingo → hoje), não dos últimos 7 dias.
 * Deduplica registros idênticos (mesma data + atividade + duração) que podem
 * chegar duplicados de importações (Strava + registro manual).
 */
export function cargaCardioSemana(
  timeline: TimelineEntry[],
  now: Date = new Date(),
): CardioCarga {
  const inicio = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay());
  const desde = `${inicio.getFullYear()}-${String(inicio.getMonth() + 1).padStart(2, "0")}-${String(
    inicio.getDate(),
  ).padStart(2, "0")}`;

  let minutos = 0;
  let intensas = 0;
  let sessoes = 0;
  const vistos = new Set<string>();

  for (const e of timeline) {
    if (!e.cardio) continue;
    if (e.date < desde) continue; // fora da semana corrente
    const chave = `${e.date}|${e.label.toLowerCase().trim()}|${Math.round(e.durationMin)}`;
    if (vistos.has(chave)) continue;
    vistos.add(chave);
    sessoes += 1;
    if (e.cardio === "alto" || e.cardio === "medio") {
      // sanidade: ignora durações absurdas vindas de importações quebradas
      minutos += Math.min(Math.max(0, e.durationMin), 300);
      if (e.cardio === "alto") intensas += 1;
    }
  }

  const nivel: CardioCarga["nivel"] = intensas >= 3 ? "alta" : intensas >= 1 ? "media" : "baixa";
  return { minutos: Math.round(minutos), sessoesIntensas: intensas, nivel, sessoes, desde };
}


export function scoreRecuperacao(c: DailyCheckin): number {
  const sonoHoras = Math.max(0, Math.min(c.sleep_hours, 10)) / 8; // 8h = 1.0
  const sonoQ = (c.sleep_quality - 1) / 4; // 1..5 → 0..1
  const dor = 1 - (c.soreness - 1) / 4; // dor 1 → 1.0, dor 5 → 0
  const energia = (c.energy - 1) / 4;
  const raw = sonoHoras * 3 + sonoQ * 3 + dor * 2 + energia * 2; // max 10
  return Math.max(0, Math.min(10, Math.round(raw * 10) / 10));
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
  checkin: DailyCheckin;
  hoje?: Date;
}): Sugestao {
  const now = args.hoje ?? new Date();
  const timeline = combineTimeline(args.sessoes, args.atividadesExtras, now);
  const liberados = gruposLiberados(timeline, now);
  const cardio = cargaCardioSemana(timeline, now);
  const score = scoreRecuperacao(args.checkin);
  const diasComEsforco = new Set(
    timeline.filter((e) => e.date >= cardio.desde).map((e) => e.date),
  ).size; // dias com esforço na semana corrente (domingo → hoje)
  const temPoucoHistorico = args.sessoes.length + args.atividadesExtras.length < 3;

  const scoreDetalhe = `Sono ${args.checkin.sleep_hours}h · qualidade ${args.checkin.sleep_quality}/5 · dor ${args.checkin.soreness}/5 · energia ${args.checkin.energy}/5`;

  // Pernas exigidas por extra intenso nas últimas 48h?
  const pernasExigidas = timeline.some((e) => {
    if (e.source !== "extra") return false;
    const dias = daysBetween(new Date(now.toISOString().slice(0, 10)), new Date(e.date));
    return dias <= 2 && (e.impact.pernas === "alto" || e.impact.pernas === "medio");
  });

  // Regra 1: descanso ativo
  if (score <= 4 || args.checkin.soreness >= 4 || diasComEsforco >= 6) {
    const motivos: string[] = [];
    if (score <= 4) motivos.push(`recuperação baixa (score ${score.toFixed(1)}/10)`);
    if (args.checkin.soreness >= 4) motivos.push(`dor muscular alta (${args.checkin.soreness}/5)`);
    if (diasComEsforco >= 6) motivos.push(`${diasComEsforco} dias de esforço na semana`);
    return {
      tipo: "descanso ativo",
      grupos: [],
      intensidade: "descanso",
      motivo: `Hoje é dia de aliviar: ${motivos.join(", ")}. Faça mobilidade, alongamento ou uma caminhada leve.`,
      score,
      scoreDetalhe,
      gruposLiberados: liberados,
      cardio,
      temPoucoHistorico,
      diasEsforcoSemana: diasComEsforco,
    };
  }

  // Usuário novo: full body moderado padrão
  if (temPoucoHistorico) {
    return {
      tipo: "full body",
      grupos: ["peito", "costas", "pernas"],
      intensidade: score >= 7 ? "moderada" : "leve",
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

  // Regra 2: funcional leve (score 4-6)
  if (score <= 6) {
    const candidato = liberados.find((l) => {
      // não pode ter sido impactado por extra recente
      const impactoRecente = timeline.some(
        (e) =>
          e.source === "extra" &&
          daysBetween(new Date(now.toISOString().slice(0, 10)), new Date(e.date)) <= 2 &&
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
        motivo: `Score moderado (${score.toFixed(1)}/10). Um funcional leve em ${MUSCLE_LABEL[grupo]} (${(() => { const d = candidato?.diasParado ?? liberados[0].diasParado; return Number.isFinite(d) ? `${formatDias(d)}d parado` : "ainda sem registro"; })()}) mantém o ritmo sem sobrecarregar.`,
        score,
        scoreDetalhe,
        gruposLiberados: liberados,
        cardio,
        temPoucoHistorico,
        diasEsforcoSemana: diasComEsforco,
      };
    }
  }

  // Regra 3: força (score > 6)
  if (score > 6 && liberados.length > 0) {
    // Filtra pernas se exigidas por extra recente
    let candidatos = liberados;
    let motivoExtra = "";
    if (pernasExigidas) {
      candidatos = liberados.filter((l) => l.grupo !== "pernas" && l.grupo !== "gluteo");
      const extra = timeline.find(
        (e) => e.source === "extra" && (e.impact.pernas === "alto" || e.impact.pernas === "medio"),
      );
      if (extra) {
        const dias = daysBetween(new Date(now.toISOString().slice(0, 10)), new Date(extra.date));
        motivoExtra = ` Você fez ${extra.label.toLowerCase()} ${dias === 0 ? "hoje" : dias === 1 ? "ontem" : `há ${dias} dias`}, então as pernas ficam de fora hoje.`;
      }
    }
    // Cardio alto na semana → evitar pernas mesmo sem extra recente
    if (cardio.nivel === "alta" && candidatos.some((c) => c.grupo === "pernas")) {
      candidatos = candidatos.filter((l) => l.grupo !== "pernas");
      motivoExtra += ` Cardio acumulado da semana está alto (${cardio.sessoesIntensas} sessões intensas).`;
    }
    const escolhido = candidatos[0] ?? liberados[0];
    if (escolhido) {
      const grupos: MuscleGroup[] = [escolhido.grupo];
      // Adiciona um grupo sinérgico
      if (escolhido.grupo === "peito") grupos.push("triceps");
      else if (escolhido.grupo === "costas") grupos.push("biceps");
      else if (escolhido.grupo === "ombro") grupos.push("triceps");
      else if (escolhido.grupo === "pernas") grupos.push("gluteo");

      const grupoLabel = joinGrupos(grupos);
      const intensidade: Intensidade = score >= 8 ? "alta" : "moderada";
      return {
        tipo: "força",
        grupos,
        intensidade,
        motivo: `Score ${score.toFixed(1)}/10 e ${escolhido.grupo} ${Number.isFinite(escolhido.diasParado) ? `há ${formatDias(escolhido.diasParado)}d sem estímulo` : "ainda sem registro na semana"} — foco em ${grupoLabel}, intensidade ${intensidade}.${motivoExtra}`,
        score,
        scoreDetalhe,
        gruposLiberados: liberados,
        cardio,
        temPoucoHistorico,
        diasEsforcoSemana: diasComEsforco,
      };
    }
  }

  // Regra 4: nenhum grupo liberado com score bom → cardio leve ou mobilidade
  if (liberados.length === 0 && score > 6) {
    if (cardio.nivel === "alta") {
      return {
        tipo: "mobilidade",
        grupos: [],
        intensidade: "leve",
        motivo: `Todos os grupos ainda em recuperação e cardio da semana já está alto (${cardio.sessoesIntensas} sessões intensas). Melhor mobilidade e alongamento hoje.`,
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
      motivo: `Nenhum grupo totalmente recuperado, mas você está bem (${score.toFixed(1)}/10). Uma caminhada ou pedalada leve aproveita o dia sem sobrecarregar.`,
      score,
      scoreDetalhe,
      gruposLiberados: liberados,
      cardio,
      temPoucoHistorico,
      diasEsforcoSemana: diasComEsforco,
    };
  }

  // Fallback: full body leve
  return {
    tipo: "full body",
    grupos: UPPER_BODY.slice(0, 3),
    intensidade: "leve",
    motivo: `Score ${score.toFixed(1)}/10. Um treino leve de parte superior mantém o ritmo.`,
    score,
    scoreDetalhe,
    gruposLiberados: liberados,
    cardio,
    temPoucoHistorico,
    diasEsforcoSemana: diasComEsforco,
  };
}

// Escolhe o workout do plano cujos exercícios mais cobrem os grupos sugeridos.
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

// ============================================================================
// Sugestão baseada em SPLIT/PLANO (ex: A, B, C, D, E).
// Rotaciona o próximo treino do plano com base no último feito.
// ============================================================================

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
  checkin: DailyCheckin;
  hoje?: Date;
}): SugestaoPlano | null {
  const plano = args.workouts
    .filter((w) => w.label && /^[A-Z]$/i.test(w.label.trim()))
    .map((w) => ({ ...w, label: w.label!.trim().toUpperCase() }))
    .sort((a, b) => a.label.localeCompare(b.label));

  if (plano.length < 2) return null;

  const now = args.hoje ?? new Date();
  const timeline = combineTimeline(args.sessoes, args.atividadesExtras, now);
  const cardio = cargaCardioSemana(timeline, now);
  const score = scoreRecuperacao(args.checkin);
  const diasComEsforco = new Set(
    timeline.filter((e) => e.date >= cardio.desde).map((e) => e.date),
  ).size; // dias com esforço na semana corrente (domingo → hoje)
  const liberados = gruposLiberados(timeline, now);
  const scoreDetalhe = `Sono ${args.checkin.sleep_hours}h · qualidade ${args.checkin.sleep_quality}/5 · dor ${args.checkin.soreness}/5 · energia ${args.checkin.energy}/5`;

  // Gate de descanso — mesmo com plano, respeita sinais do corpo
  if (score <= 4 || args.checkin.soreness >= 4 || diasComEsforco >= 6) {
    return null; // caller cai no fluxo geral (descanso ativo)
  }

  // Encontra último treino do plano executado
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

  // Ordem de rotação a partir do último feito, mas priorizando o treino
  // cujos grupos estão descansados há mais tempo — evita repetir (ex: bíceps
  // treinado há 2 dias) quando existe um treino com mais dias de descanso.
  const rotacao = plano.map((_, i) =>
    plano[((ultimoIdx < 0 ? -1 : ultimoIdx) + 1 + i) % plano.length],
  );
  let melhor: { w: PlanoWorkout & { label: string }; score: number } | null = null;
  rotacao.forEach((w, pos) => {
    const gs = gruposDoWorkoutNome(w.label, w.name);
    const descansos = gs.map((g) => diasDesdeUltimoEsforco(timeline, g, now));
    const minDescanso = descansos.length ? Math.min(...descansos) : Number.POSITIVE_INFINITY;
    const recuperado = gs.every((g, i) => descansos[i] >= MUSCLE_RECOVERY_DAYS[g]);
    const score =
      (recuperado ? 1000 : 0) +
      Math.min(Number.isFinite(minDescanso) ? minDescanso : 30, 30) -
      pos * 0.01;
    if (!melhor || score > melhor.score) melhor = { w, score };
  });
  const proximo = (melhor as { w: PlanoWorkout & { label: string } } | null)?.w ?? rotacao[0];
  const proximoIdx = plano.findIndex((p) => p.id === proximo.id);

  // Se pernas exigidas por extra intenso recente, pula para o próximo do plano que não seja de pernas
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
        ? ` Pulei o treino de pernas do plano porque você fez ${extra.label.toLowerCase()} nas últimas 48h.`
        : "";
    }
  }

  // Recuperação por grupo: se o próximo do plano tem algum grupo ainda não recuperado
  // (ex: treinou peito ontem e o próximo é peito/tríceps), avança no plano até um treino
  // cujos grupos estejam todos liberados.
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
        const dias = Math.min(
          ...pendentes.map((g) => diasDesdeUltimoEsforco(timeline, g, now)),
        );
        motivoRecuperacao = ` Pulei o ${escolhido.label} do plano porque ${pulados} ainda está em recuperação (treinado há ${formatDias(dias)}d, precisa de ${MUSCLE_RECOVERY_DAYS[pendentes[0]]}d).`;
        escolhido = cand;
        gruposEscolhidoAtual = gs;
        pendentes = [];
        break;
      }
    }
  }

  const gruposEscolhido = gruposEscolhidoAtual;
  const intensidade: Intensidade = score >= 8 ? "alta" : score >= 6 ? "moderada" : "leve";
  const motivo = ultimaLabel
    ? `Último treino do plano: ${ultimaLabel}. Hoje é o ${escolhido.label} — ${escolhido.name}. Score ${score.toFixed(1)}/10, intensidade ${intensidade}.${motivoExtra}${motivoRecuperacao}`
    : `Começando pelo ${escolhido.label} — ${escolhido.name}. Score ${score.toFixed(1)}/10, intensidade ${intensidade}.${motivoExtra}${motivoRecuperacao}`;


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

// ============================================================================
// Rotação simples do plano — independente de check-in diário.
// Dado o último treino do plano efetivamente concluído, devolve o próximo.
// ============================================================================

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

/**
 * Próximo treino da rotina com base no último concluído.
 * - Sem histórico → primeiro treino da rotina.
 * - Último = último da lista → recicla para o primeiro.
 */
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

/**
 * Próximo treino da rotina considerando a recuperação muscular real.
 * Percorre a rotina a partir do último concluído e prefere o treino cujos
 * grupos estão descansados há mais tempo (evita repetir bíceps treinado há 2d).
 */
export function proximoNaRotinaComRecuperacao<T extends RotinaWorkout>(
  workouts: T[],
  ultimoWorkoutId: string | null | undefined,
  timeline: TimelineEntry[],
  now: Date = new Date(),
): T | null {
  const rotina = ordenarRotina(workouts);
  if (rotina.length === 0) return null;
  if (timeline.length === 0) return proximoNaRotina(workouts, ultimoWorkoutId);
  const idx = ultimoWorkoutId ? rotina.findIndex((w) => w.id === ultimoWorkoutId) : -1;
  let melhor: { w: T; score: number } | null = null;
  for (let pos = 0; pos < rotina.length; pos++) {
    const w = rotina[(idx + 1 + pos) % rotina.length];
    const gs = gruposDoWorkoutNome(String(w.label ?? ""), w.name);
    const descansos = gs.map((g) => diasDesdeUltimoEsforco(timeline, g, now));
    const minDescanso = descansos.length ? Math.min(...descansos) : Number.POSITIVE_INFINITY;
    const recuperado = gs.every((g, i) => descansos[i] >= MUSCLE_RECOVERY_DAYS[g]);
    const score =
      (recuperado ? 1000 : 0) +
      Math.min(Number.isFinite(minDescanso) ? minDescanso : 30, 30) -
      pos * 0.01;
    if (!melhor || score > melhor.score) melhor = { w, score };
  }
  return melhor?.w ?? rotina[0];
}

// ============================================================================
// Autoridade única para a decisão treinar × descansar.
//
// O motor de Recuperação (`recovery-core.ts`) é a AUTORIDADE: considera RPE,
// lesão, frequência semanal, ciclo, sono e inatividade. A sugestão do dia
// continua decidindo QUAL treino/grupo, mas a intensidade/descanso é
// rebaixada aqui para nunca contradizer o card de Recuperação.
// ============================================================================

export type RecoveryAuthority = {
  status: "recuperado" | "leve" | "cuidado" | "descanso";
  score: number; // 0-100
  intensityLabel?: string;
};

const INTENSIDADE_RANK: Record<Intensidade, number> = {
  descanso: 0,
  leve: 1,
  moderada: 2,
  alta: 3,
};

const TETO_POR_STATUS: Record<RecoveryAuthority["status"], Intensidade> = {
  recuperado: "alta",
  leve: "moderada",
  cuidado: "leve",
  descanso: "descanso",
};

// Piso: só a Recuperação pode mandar descansar. Se ela diz que dá pra treinar,
// a sugestão do dia não pode contradizer pedindo descanso total.
const PISO_POR_STATUS: Record<RecoveryAuthority["status"], Intensidade> = {
  recuperado: "moderada",
  leve: "leve",
  cuidado: "leve",
  descanso: "descanso",
};

/** Recuperação mandou descansar? Nesse caso nada de treino de força. */
export function recuperacaoExigeDescanso(rec: RecoveryAuthority | null | undefined): boolean {
  return !!rec && rec.status === "descanso";
}

export function alinharComRecuperacao(
  sugestao: Sugestao,
  rec: RecoveryAuthority | null | undefined,
): Sugestao {
  if (!rec) return sugestao;

  const teto = TETO_POR_STATUS[rec.status];
  const piso = PISO_POR_STATUS[rec.status];
  const atual = INTENSIDADE_RANK[sugestao.intensidade];

  // 1) Rebaixar quando a sugestão é mais agressiva do que a Recuperação permite
  if (atual > INTENSIDADE_RANK[teto]) {
    const nota = ` Ajustado pela Recuperação (${rec.score}/100): ${
      teto === "descanso" ? "hoje o corpo pede descanso" : `intensidade limitada a ${teto}`
    }.`;

    if (teto === "descanso") {
      return {
        ...sugestao,
        tipo: "descanso ativo",
        grupos: [],
        intensidade: "descanso",
        motivo: `Hoje é dia de aliviar.${nota} Faça mobilidade, alongamento ou uma caminhada leve.`,
      };
    }

    return {
      ...sugestao,
      tipo: sugestao.tipo === "força" && teto === "leve" ? "funcional leve" : sugestao.tipo,
      intensidade: teto,
      motivo: sugestao.motivo + nota,
    };
  }

  // 2) Elevar quando a sugestão pede descanso mas a Recuperação libera treino
  if (atual < INTENSIDADE_RANK[piso]) {
    const nota = ` Ajustado pela Recuperação (${rec.score}/100 · ${rec.status}): dá pra treinar hoje, ${
      piso === "leve" ? "mas mantenha leve" : "com carga moderada"
    }.`;

    if (sugestao.intensidade === "descanso") {
      const grupos = sugestao.grupos.length
        ? sugestao.grupos
        : sugestao.gruposLiberados.slice(0, 2).map((g) => g.grupo);
      return {
        ...sugestao,
        tipo: grupos.length ? "funcional leve" : "cardio leve",
        grupos,
        intensidade: piso,
        motivo:
          `Treino ${piso} hoje.${nota}` +
          (grupos.length ? ` Foco em ${joinGrupos(grupos)}, sem buscar falha.` : " Caminhada, bike leve ou mobilidade."),
      };
    }

    return {
      ...sugestao,
      intensidade: piso,
      motivo: sugestao.motivo + nota,
    };
  }

  return sugestao;
}

