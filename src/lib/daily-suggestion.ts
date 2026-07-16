// Sugestão de treino do dia — lógica 100% local, determinística.
// Zero chamadas externas. Testável.

export type MuscleGroup =
  | "peito"
  | "costas"
  | "pernas"
  | "ombro"
  | "biceps"
  | "triceps"
  | "gluteo"
  | "abdomen";

export const MUSCLE_GROUPS: MuscleGroup[] = [
  "peito",
  "costas",
  "pernas",
  "ombro",
  "biceps",
  "triceps",
  "gluteo",
  "abdomen",
];

export const MUSCLE_LABEL: Record<MuscleGroup, string> = {
  peito: "Peito",
  costas: "Costas",
  pernas: "Pernas",
  ombro: "Ombro",
  biceps: "Bíceps",
  triceps: "Tríceps",
  gluteo: "Glúteo",
  abdomen: "Abdômen",
};

export const MUSCLE_RECOVERY_DAYS: Record<MuscleGroup, number> = {
  peito: 2,
  costas: 2,
  pernas: 3,
  ombro: 2,
  biceps: 1,
  triceps: 1,
  gluteo: 2,
  abdomen: 1,
};

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
  if (/futebol|society|fut\b/.test(s)) return "futebol";
  if (/corr(er|ida)|run/.test(s)) return "corrida";
  if (/nata|swim/.test(s)) return "natacao";
  if (/bike|ciclism|cycling|pedal/.test(s)) return "ciclismo";
  if (/caminha|walk/.test(s)) return "caminhada";
  if (/volei|volley/.test(s)) return "volei";
  return null;
}

// Normaliza grupos livres do banco (ex: "Peitoral", "Quadríceps") para um MuscleGroup.
export function normalizeMuscleGroup(raw: string | null | undefined): MuscleGroup | null {
  if (!raw) return null;
  const s = raw
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  if (/peito|peitoral|chest/.test(s)) return "peito";
  if (/costas|dorsal|back|latiss/.test(s)) return "costas";
  if (/perna|quadr|posterior|panturr|leg|quads|hams/.test(s)) return "pernas";
  if (/ombro|delto|shoulder/.test(s)) return "ombro";
  if (/bicep/.test(s)) return "biceps";
  if (/tricep/.test(s)) return "triceps";
  if (/gluteo|gluteos|gluteus|butt/.test(s)) return "gluteo";
  if (/abdom|core|abs/.test(s)) return "abdomen";
  return null;
}

export type TimelineEntry = {
  date: string; // yyyy-mm-dd
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

// Dias desde o último esforço de impacto médio/alto num grupo (Infinity se nunca).
export function diasDesdeUltimoEsforco(
  timeline: TimelineEntry[],
  grupo: MuscleGroup,
  now: Date = new Date(),
): number {
  const today = new Date(now.toISOString().slice(0, 10));
  let best: number | null = null;
  for (const e of timeline) {
    const impact = e.impact[grupo];
    if (impact === "alto" || impact === "medio") {
      const diff = daysBetween(today, new Date(e.date));
      if (best == null || diff < best) best = diff;
    }
  }
  return best == null ? Number.POSITIVE_INFINITY : best;
}

export function gruposLiberados(
  timeline: TimelineEntry[],
  now: Date = new Date(),
): { grupo: MuscleGroup; diasParado: number }[] {
  return MUSCLE_GROUPS.map((g) => ({ grupo: g, diasParado: diasDesdeUltimoEsforco(timeline, g, now) }))
    .filter((x) => x.diasParado >= MUSCLE_RECOVERY_DAYS[x.grupo])
    .sort((a, b) => b.diasParado - a.diasParado);
}

export type CardioCarga = { minutos: number; sessoesIntensas: number; nivel: "baixa" | "media" | "alta" };

export function cargaCardioSemana(timeline: TimelineEntry[]): CardioCarga {
  let minutos = 0;
  let intensas = 0;
  for (const e of timeline) {
    if (!e.cardio) continue;
    if (e.cardio === "alto" || e.cardio === "medio") {
      minutos += e.durationMin;
      if (e.cardio === "alto") intensas += 1;
    }
  }
  const nivel: CardioCarga["nivel"] = intensas >= 3 ? "alta" : intensas >= 1 ? "media" : "baixa";
  return { minutos: Math.round(minutos), sessoesIntensas: intensas, nivel };
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
  const cardio = cargaCardioSemana(timeline);
  const score = scoreRecuperacao(args.checkin);
  const diasComEsforco = new Set(timeline.map((e) => e.date)).size;
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
        motivo: `Score moderado (${score.toFixed(1)}/10). Um funcional leve em ${MUSCLE_LABEL[grupo]} (${candidato?.diasParado ?? liberados[0].diasParado}d parado) mantém o ritmo sem sobrecarregar.`,
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
        motivo: `Score ${score.toFixed(1)}/10 e ${escolhido.grupo} há ${escolhido.diasParado}d sem estímulo — foco em ${grupoLabel}, intensidade ${intensidade}.${motivoExtra}`,
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
