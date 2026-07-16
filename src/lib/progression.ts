// Cálculo determinístico de sugestões de carga e descanso.
// Baseado no histórico das últimas sessões (session_sets) por workout_exercise.

export type RepRange = { min: number; max: number; isAmrap: boolean };

export type SetRow = {
  weight_kg: number | null;
  reps: number | null;
  rpe: number | null;
  session_id: string;
  completed_at: string;
};

export type SessionSummary = {
  sessionId: string;
  date: string;
  avgLoad: number | null;
  avgReps: number | null;
  avgRpe: number | null;
  setCount: number;
};

export type CardioLoad = {
  started_at: string;
  ended_at: string | null;
  avg_hr: number | null;
  max_hr: number | null;
  calories: number | null;
  distance_m: number | null;
  activity_type: string | null;
};

/**
 * Fatigue signal derived from cardio sessions in the last N days linked to this workout.
 * Returns:
 *   - level: "high" if any recent cardio was intense (avg_hr>=150 OR max_hr>=175 OR duration>60min at avg_hr>=130)
 *           "moderate" if 2+ sessions with avg_hr>=130 in the window
 *           "none" otherwise
 *   - summary: human readable phrase describing what was seen
 */
export type CardioFatigue = {
  level: "high" | "moderate" | "none";
  summary: string | null;
  count: number;
};

export function computeCardioFatigue(loads: CardioLoad[], now: Date = new Date()): CardioFatigue {
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 3600 * 1000);
  const recent = loads.filter((l) => new Date(l.started_at) >= sevenDaysAgo);
  if (recent.length === 0) return { level: "none", summary: null, count: 0 };

  const durationMin = (l: CardioLoad) =>
    l.ended_at ? Math.max(0, (new Date(l.ended_at).getTime() - new Date(l.started_at).getTime()) / 60000) : 0;

  // Pace em min/km (menor = mais rápido = mais intenso). Só faz sentido p/ atividades com deslocamento.
  const paceMinPerKm = (l: CardioLoad) => {
    const dur = durationMin(l);
    if (!l.distance_m || l.distance_m < 500 || dur <= 0) return null;
    return dur / (l.distance_m / 1000);
  };

  // Sinais de intensidade por sessão: FC alta OU longa duração em FC moderada OU ritmo rápido OU longa distância.
  const isIntense = (l: CardioLoad) => {
    if (l.avg_hr != null && l.avg_hr >= 150) return true;
    if (l.max_hr != null && l.max_hr >= 175) return true;
    if (durationMin(l) >= 60 && (l.avg_hr ?? 0) >= 130) return true;
    const pace = paceMinPerKm(l);
    // Ritmo <5:00/km em corrida/bike é sinal de esforço alto mesmo sem FC.
    if (pace != null && pace <= 5 && (l.distance_m ?? 0) >= 3000) return true;
    // Volume alto de endurance (>15 km) também conta como carga significativa.
    if ((l.distance_m ?? 0) >= 15000) return true;
    return false;
  };

  const isModerate = (l: CardioLoad) => {
    if ((l.avg_hr ?? 0) >= 130) return true;
    const pace = paceMinPerKm(l);
    if (pace != null && pace <= 6.5 && (l.distance_m ?? 0) >= 3000) return true;
    if ((l.distance_m ?? 0) >= 8000) return true;
    if (durationMin(l) >= 45) return true;
    return false;
  };

  const intense = recent.some(isIntense);
  const moderateCount = recent.filter(isModerate).length;

  const describe = (l: CardioLoad) => {
    const parts: string[] = [];
    if (l.avg_hr) parts.push(`FC média ${l.avg_hr}`);
    if (l.max_hr) parts.push(`máx ${l.max_hr}`);
    const pace = paceMinPerKm(l);
    if (pace != null) {
      const m = Math.floor(pace);
      const s = Math.round((pace - m) * 60).toString().padStart(2, "0");
      parts.push(`ritmo ${m}:${s}/km`);
    }
    if (l.distance_m && l.distance_m >= 1000) parts.push(`${(l.distance_m / 1000).toFixed(1)} km`);
    const dur = durationMin(l);
    if (dur >= 20) parts.push(`${Math.round(dur)} min`);
    return parts.join(" · ") || "alto volume";
  };

  if (intense) {
    // Escolhe a sessão "pior" — prioriza FC alta, cai para ritmo mais rápido, e depois maior distância.
    const worst = recent.reduce((best, l) => {
      const score = (l.avg_hr ?? 0) * 10 + (l.max_hr ?? 0) + (l.distance_m ?? 0) / 1000;
      const bestScore = (best.avg_hr ?? 0) * 10 + (best.max_hr ?? 0) + (best.distance_m ?? 0) / 1000;
      return score > bestScore ? l : best;
    }, recent[0]);
    return {
      level: "high",
      summary: `Cardio intenso nos últimos 7 dias (${describe(worst)})`,
      count: recent.length,
    };
  }
  if (moderateCount >= 2) {
    return {
      level: "moderate",
      summary: `${moderateCount} sessões de cardio moderado nos últimos 7 dias`,
      count: recent.length,
    };
  }
  return { level: "none", summary: null, count: recent.length };
}


export type Suggestion = {
  suggested_weight_kg: number | null;
  suggested_rest_seconds: number | null;
  loadDirection: "up" | "down" | "hold" | "none";
  restDirection: "up" | "down" | "hold" | "none";
  reason: string;
  confidence: "low" | "medium" | "high";
  sessions: SessionSummary[];
  cardioFatigue?: CardioFatigue;
};

/** Aceita "8-12", "10", "AMRAP", "12+", "10 a 12". */
export function parseRepRange(input: string | number | null | undefined): RepRange {
  if (input == null) return { min: 8, max: 12, isAmrap: false };
  const raw = String(input).trim().toLowerCase();
  if (!raw) return { min: 8, max: 12, isAmrap: false };
  if (/amrap|máx|max/.test(raw)) return { min: 8, max: 12, isAmrap: true };
  const nums = raw.match(/\d+/g)?.map(Number) ?? [];
  if (nums.length === 0) return { min: 8, max: 12, isAmrap: false };
  if (nums.length === 1) {
    const n = nums[0];
    return { min: n, max: n, isAmrap: raw.endsWith("+") };
  }
  const [a, b] = nums;
  return { min: Math.min(a, b), max: Math.max(a, b), isAmrap: false };
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0);

export function summarizeSession(sets: SetRow[]): Omit<SessionSummary, "sessionId" | "date"> {
  const loads = sets.map((s) => s.weight_kg).filter((v): v is number => typeof v === "number" && v > 0);
  const reps = sets.map((s) => s.reps).filter((v): v is number => typeof v === "number" && v > 0);
  const rpes = sets.map((s) => s.rpe).filter((v): v is number => typeof v === "number" && v > 0);
  return {
    avgLoad: loads.length ? mean(loads) : null,
    avgReps: reps.length ? mean(reps) : null,
    avgRpe: rpes.length ? mean(rpes) : null,
    setCount: sets.length,
  };
}

/** Agrupa por session_id, mais recente primeiro; limita a `keep` sessões. */
export function groupBySession(rows: SetRow[], keep = 3): SessionSummary[] {
  const bySession = new Map<string, SetRow[]>();
  for (const r of rows) {
    if (!bySession.has(r.session_id)) bySession.set(r.session_id, []);
    bySession.get(r.session_id)!.push(r);
  }
  const summaries: SessionSummary[] = [];
  for (const [sessionId, sets] of bySession) {
    const s = summarizeSession(sets);
    const date = sets.reduce((max, r) => (r.completed_at > max ? r.completed_at : max), sets[0].completed_at);
    summaries.push({ sessionId, date, ...s });
  }
  summaries.sort((a, b) => (a.date < b.date ? 1 : -1));
  return summaries.slice(0, keep);
}

/** Arredonda para o múltiplo mais próximo. */
const roundTo = (v: number, step: number) => Math.round(v / step) * step;

export function suggestAdjustment(args: {
  currentWeight: number | null;
  currentRest: number;
  repRange: string | number | null | undefined;
  rows: SetRow[];
  cardioLoads?: CardioLoad[];
}): Suggestion {
  const range = parseRepRange(args.repRange);
  const sessions = groupBySession(args.rows, 3);
  const last = sessions[0];
  const prev = sessions[1];
  const cardioFatigue = args.cardioLoads ? computeCardioFatigue(args.cardioLoads) : { level: "none" as const, summary: null, count: 0 };

  const base: Suggestion = {
    suggested_weight_kg: args.currentWeight,
    suggested_rest_seconds: args.currentRest,
    loadDirection: "none",
    restDirection: "none",
    reason: "Poucos dados ainda — registre pelo menos 2 sessões deste exercício.",
    confidence: "low",
    sessions,
    cardioFatigue,
  };

  if (!last || !prev) {
    // Even without lifting history, cardio fatigue alone can suggest bumping rest.
    if (cardioFatigue.level === "high") {
      return {
        ...base,
        suggested_rest_seconds: Math.min(240, args.currentRest + 30),
        restDirection: "up",
        reason: `${cardioFatigue.summary}. Considere descansar mais entre séries.`,
      };
    }
    return base;
  }

  // --- Carga ---
  const currentLoad = args.currentWeight ?? last.avgLoad ?? 0;
  const target = range.isAmrap ? 12 : range.max;
  const floor = range.isAmrap ? 8 : range.min;
  const lastReps = last.avgReps ?? 0;
  const prevReps = prev.avgReps ?? 0;

  let loadDirection: Suggestion["loadDirection"] = "hold";
  let suggestedWeight = currentLoad;

  if (lastReps >= target + 1 && prevReps >= target) {
    // Under high cardio fatigue, hold the load instead of bumping — recovery first.
    if (cardioFatigue.level === "high") {
      loadDirection = "hold";
    } else {
      const bump = currentLoad >= 40 ? currentLoad * 0.05 : 2.5;
      suggestedWeight = roundTo(currentLoad + bump, 2.5);
      loadDirection = "up";
    }
  } else if (lastReps > 0 && prevReps > 0 && lastReps < floor - 1 && prevReps < floor) {
    suggestedWeight = roundTo(currentLoad * 0.95, 2.5);
    loadDirection = "down";
  }
  if (suggestedWeight <= 0) suggestedWeight = currentLoad;

  // --- Descanso ---
  const rpeSamples = [last.avgRpe, prev.avgRpe].filter((v): v is number => typeof v === "number");
  let restDirection: Suggestion["restDirection"] = "none";
  let suggestedRest = args.currentRest;
  if (rpeSamples.length >= 1) {
    const avgRpe = mean(rpeSamples);
    if (avgRpe >= 9) {
      suggestedRest = Math.min(240, args.currentRest + 15);
      restDirection = "up";
    } else if (avgRpe <= 6) {
      suggestedRest = Math.max(30, args.currentRest - 15);
      restDirection = "down";
    } else {
      restDirection = "hold";
    }
  }

  // Cardio fatigue nudges rest UP even when RPE alone wouldn't.
  if (cardioFatigue.level === "high") {
    const bumped = Math.min(240, Math.max(suggestedRest, args.currentRest) + 30);
    if (bumped > suggestedRest) {
      suggestedRest = bumped;
      restDirection = "up";
    }
  } else if (cardioFatigue.level === "moderate" && restDirection !== "up") {
    const bumped = Math.min(240, args.currentRest + 15);
    if (bumped > suggestedRest) {
      suggestedRest = bumped;
      restDirection = "up";
    }
  }

  // --- Confiança ---
  const confidence: Suggestion["confidence"] =
    sessions.length >= 3 && sessions.every((s) => s.setCount >= 2) ? "high" : sessions.length >= 3 ? "medium" : "low";

  // --- Motivo ---
  const repList = sessions
    .map((s) => (s.avgReps != null ? Math.round(s.avgReps) : "?"))
    .join(", ");
  const loadList = sessions
    .map((s) => (s.avgLoad != null ? `${Math.round(s.avgLoad * 10) / 10}kg` : "?"))
    .join(", ");
  const parts = [`Últimas ${sessions.length} sessões: reps ${repList} @ ${loadList}`];
  if (rpeSamples.length) parts.push(`RPE médio ${mean(rpeSamples).toFixed(1)}`);
  if (cardioFatigue.summary) parts.push(cardioFatigue.summary);

  return {
    suggested_weight_kg: suggestedWeight === currentLoad ? args.currentWeight : suggestedWeight,
    suggested_rest_seconds: suggestedRest,
    loadDirection,
    restDirection,
    reason: parts.join(" · "),
    confidence,
    sessions,
    cardioFatigue,
  };
}

export function hasChange(s: Suggestion, currentWeight: number | null, currentRest: number) {
  const loadChanged =
    s.loadDirection === "up" || s.loadDirection === "down"
      ? (s.suggested_weight_kg ?? null) !== (currentWeight ?? null)
      : false;
  const restChanged =
    s.restDirection === "up" || s.restDirection === "down"
      ? s.suggested_rest_seconds !== currentRest
      : false;
  return { loadChanged, restChanged, any: loadChanged || restChanged };
}
