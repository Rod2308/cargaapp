/**
 * Recovery engine — server-only pure logic.
 *
 * This file exports the shared helper `computeRecoveryAdviceFor(supabase, userId)`
 * used by:
 *  - the `getRecoveryAdvice` server function (recovery.functions.ts)
 *  - the `get_recovery_status` tool inside the AI coach (coach.functions.ts)
 *
 * We keep it in a `.server.ts` file so it can be safely imported by other
 * server-fn handlers without going through the RPC stub (which would fail
 * with "Server function info not found for <hash>" in production).
 */

import { generateText, Output, NoObjectGeneratedError } from "ai";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

const FactorSchema = z.object({
  key: z.string(),
  label: z.string(),
  detail: z.string(),
  impact: z.number(),
});

const IgnoredFactorSchema = z.object({
  key: z.string(),
  label: z.string(),
  reason: z.string(),
});

const RecoverySchema = z.object({
  status: z.enum(["recuperado", "leve", "cuidado", "descanso"]),
  score: z.number().min(0).max(100),
  intensityPct: z.number().min(0).max(100),
  intensityLabel: z.string(),
  headline: z.string(),
  reason: z.string(),
  recommendation: z.string(),
  tip: z.string(),
  canDo: z.array(z.string()),
  avoid: z.array(z.string()),
  factors: z.array(FactorSchema),
  ignoredFactors: z.array(IgnoredFactorSchema),
});

export type RecoveryAdvice = z.infer<typeof RecoverySchema>;
type Factor = z.infer<typeof FactorSchema>;

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

function scoreToStatus(score: number): RecoveryAdvice["status"] {
  if (score >= 80) return "recuperado";
  if (score >= 60) return "leve";
  if (score >= 40) return "cuidado";
  return "descanso";
}

function scoreToIntensity(score: number): { pct: number; label: string } {
  const pct = Math.round(clamp(Math.pow(score / 100, 0.9) * 100, 0, 100));
  if (pct >= 90) return { pct, label: "Carga normal — pode progredir" };
  if (pct >= 70) return { pct, label: `Reduza para ~${pct}% da carga usual` };
  if (pct >= 45) return { pct, label: `Treino leve · ~${pct}% da carga` };
  if (pct >= 25) return { pct, label: "Descanso ativo (mobilidade, caminhada)" };
  return { pct, label: "Priorize descanso total hoje" };
}

function combinePenalties(penalties: number[]): number {
  let survive = 1;
  for (const p of penalties) survive *= 1 - clamp(p, 0, 100) / 100;
  return Math.round(clamp(100 * (1 - survive), 0, 100));
}

type SessionRow = {
  started_at: string;
  ended_at: string | null;
  perceived_effort: number | null;
  session_sets: {
    reps: number | null;
    weight_kg: number | null;
    rpe: number | null;
    exercises: { name: string | null; muscle_group: string | null } | null;
  }[];
};

type SleepRow = { log_date: string; hours: number; quality: number | null };

type ProfileRow = {
  experience_level: string | null;
  uses_enhancers: boolean | null;
  birth_date: string | null;
  activity_level: string | null;
  injuries: string | null;
  weekly_frequency: number | null;
  sex: string | null;
  cycle_tracking_enabled: boolean | null;
  cycle_last_period_start: string | null;
  cycle_length_days: number | null;
  cycle_period_length_days: number | null;
};

type IgnoredFactor = { key: string; label: string; reason: string };

type MuscleAgg = { group: string; setsRecent: number; volume: number; avgRpe: number | null; lastDaysAgo: number };

function ageYears(birth: string | null): number | null {
  if (!birth) return null;
  const b = new Date(birth);
  if (isNaN(b.getTime())) return null;
  const n = new Date();
  let a = n.getFullYear() - b.getFullYear();
  const m = n.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && n.getDate() < b.getDate())) a--;
  return a;
}

function aggregateMuscles(sessions: SessionRow[], now: Date): MuscleAgg[] {
  const map = new Map<string, MuscleAgg>();
  for (const s of sessions) {
    const daysAgo = (now.getTime() - new Date(s.started_at).getTime()) / 86_400_000;
    if (daysAgo > 5) continue;
    for (const st of s.session_sets ?? []) {
      const g = st.exercises?.muscle_group;
      if (!g || g === "Esportes") continue;
      const cur =
        map.get(g) ?? { group: g, setsRecent: 0, volume: 0, avgRpe: null, lastDaysAgo: 999 };
      cur.setsRecent += 1;
      cur.volume += (Number(st.reps) || 0) * (Number(st.weight_kg) || 0);
      if (st.rpe) cur.avgRpe = cur.avgRpe == null ? Number(st.rpe) : (cur.avgRpe + Number(st.rpe)) / 2;
      cur.lastDaysAgo = Math.min(cur.lastDaysAgo, daysAgo);
      map.set(g, cur);
    }
  }
  return Array.from(map.values());
}

function computeScore(input: {
  profile: ProfileRow | null;
  sessions: SessionRow[];
  sleep: SleepRow[];
  now: Date;
  cycle: import("./cycle").CycleInfo | null;
}) {
  const { profile, sessions, sleep, now } = input;
  const factors: Factor[] = [];

  const experienced = ["intermediario", "avancado", "avançado"].includes(
    (profile?.experience_level ?? "").toLowerCase(),
  );
  const enhancers = !!profile?.uses_enhancers;
  const age = ageYears(profile?.birth_date ?? null);
  const tolerance = (experienced ? 1.15 : 1) * (enhancers ? 1.1 : 1) * (age && age > 40 ? 0.9 : 1);

  const recentSessions = sessions.filter(
    (s) => (now.getTime() - new Date(s.started_at).getTime()) / 86_400_000 <= 3,
  );
  let trainingPenalty = 0;
  let bigSetsCount = 0;
  let hardestRpe = 0;
  for (const s of recentSessions) {
    const daysAgo = (now.getTime() - new Date(s.started_at).getTime()) / 86_400_000;
    const recency = clamp(1 - daysAgo / 3.5, 0.15, 1);
    const sets = (s.session_sets ?? []).filter((st) => st.exercises?.muscle_group !== "Esportes").length;
    const rpes = (s.session_sets ?? []).map((st) => Number(st.rpe) || 0).filter((v) => v > 0);
    const rpe = rpes.length ? rpes.reduce((a, b) => a + b, 0) / rpes.length : 0;
    const effort = Number(s.perceived_effort) || 0;
    bigSetsCount += sets;
    hardestRpe = Math.max(hardestRpe, rpe, effort);
    const raw = (sets / 20) * 20 + Math.max(0, rpe - 7) * 7 + Math.max(0, effort - 3) * 6;
    trainingPenalty += raw * recency;
  }
  trainingPenalty = clamp(trainingPenalty / tolerance, 0, 55);
  if (trainingPenalty >= 6) {
    factors.push({
      key: "training",
      label: "Treinos recentes pesados",
      detail: `${recentSessions.length} sessão(ões) nos últimos 3d · ${bigSetsCount} série(s)${
        hardestRpe ? ` · pico RPE/esforço ${hardestRpe.toFixed(1)}` : ""
      }`,
      impact: Math.round(trainingPenalty),
    });
  }

  const muscles = aggregateMuscles(sessions, now);
  const overlapped = muscles.filter((m) => m.lastDaysAgo < 1.75 && m.setsRecent >= 4);
  let musclePenalty = 0;
  if (overlapped.length > 0) {
    musclePenalty = clamp(overlapped.length * 8, 0, 20);
    factors.push({
      key: "muscle-overlap",
      label: "Grupos ainda em recuperação",
      detail: overlapped.map((m) => `${m.group} há ${m.lastDaysAgo.toFixed(1)}d (${m.setsRecent} séries)`).join(", "),
      impact: Math.round(musclePenalty),
    });
  }

  const nights = [...sleep].sort((a, b) => (a.log_date < b.log_date ? 1 : -1));
  const last = nights[0] ?? null;
  const win = nights.slice(0, 7);
  const avgH = win.length ? win.reduce((a, s) => a + Number(s.hours), 0) / win.length : null;
  const qArr = win.filter((s) => s.quality != null);
  const avgQ = qArr.length ? qArr.reduce((a, s) => a + Number(s.quality), 0) / qArr.length : null;

  let sleepPenalty = 0;
  const sleepBits: string[] = [];
  if (last && Number(last.hours) < 6) {
    sleepPenalty += (6 - Number(last.hours)) * 9;
    sleepBits.push(`última noite ${last.hours}h`);
  }
  if (avgH != null && avgH < 6.5) {
    sleepPenalty += (6.5 - avgH) * 8;
    sleepBits.push(`média ${avgH.toFixed(1)}h`);
  }
  if (avgQ != null && avgQ <= 2.5) {
    sleepPenalty += (2.5 - avgQ) * 6;
    sleepBits.push(`qualidade ${avgQ.toFixed(1)}/5`);
  }
  if (!last && !avgH) {
    sleepPenalty += 4;
    sleepBits.push("sem registro");
  }
  sleepPenalty = clamp(sleepPenalty, 0, 35);
  if (sleepPenalty >= 3) {
    factors.push({
      key: "sleep",
      label: "Sono insuficiente",
      detail: sleepBits.join(" · "),
      impact: Math.round(sleepPenalty),
    });
  }

  const sportMinutes48h = sessions
    .filter((s) => (now.getTime() - new Date(s.started_at).getTime()) / 86_400_000 <= 2)
    .flatMap((s) => s.session_sets ?? [])
    .filter((st) => st.exercises?.muscle_group === "Esportes")
    .reduce((a, st) => a + (Number(st.reps) || 0), 0);
  let sportPenalty = 0;
  if (sportMinutes48h >= 45) {
    sportPenalty = clamp(((sportMinutes48h - 30) / 60) * 12, 0, 20);
    factors.push({
      key: "sport",
      label: "Atividade extra recente",
      detail: `${sportMinutes48h} min de esporte nas últimas 48h`,
      impact: Math.round(sportPenalty),
    });
  }

  let cyclePenalty = 0;
  const c = input.cycle;
  if (c) {
    if (c.phase === "menstrual") cyclePenalty = 12;
    else if (c.isLatePhaseLutea) cyclePenalty = 9;
    else if (c.phase === "lutea") cyclePenalty = 4;
    if (c.daysUntilNextPeriod <= 2 && c.phase !== "menstrual") cyclePenalty += 3;
    if (cyclePenalty > 0) {
      factors.push({
        key: "cycle",
        label: `Fase ${c.phaseLabel.toLowerCase()}`,
        detail: `dia ${c.dayInCycle}/${c.cycleLength}${c.isLatePhaseLutea ? " (TPM)" : ""}`,
        impact: cyclePenalty,
      });
    }
  }

  let injuryPenalty = 0;
  const injuriesText = (profile?.injuries ?? "").trim();
  if (injuriesText) {
    const strong = /(forte|aguda|grave|crônic|hérnia|tendinite|lesão|inflamação|dor intensa)/i.test(injuriesText);
    injuryPenalty = strong ? 14 : 6;
    factors.push({
      key: "injury",
      label: "Lesão/limitação ativa",
      detail: injuriesText.length > 80 ? injuriesText.slice(0, 77) + "…" : injuriesText,
      impact: injuryPenalty,
    });
  }

  const daysWithSession = new Set<string>();
  for (const s of sessions) {
    daysWithSession.add(new Date(s.started_at).toISOString().slice(0, 10));
  }
  let streak = 0;
  const d = new Date(now);
  while (true) {
    const key = d.toISOString().slice(0, 10);
    if (daysWithSession.has(key)) {
      streak++;
      d.setDate(d.getDate() - 1);
    } else break;
    if (streak > 14) break;
  }
  const last7 = Array.from(daysWithSession).filter(
    (k) => (now.getTime() - new Date(k).getTime()) / 86_400_000 <= 7,
  ).length;
  const targetFreq = clamp(Number(profile?.weekly_frequency) || 4, 2, 7);
  let freqPenalty = 0;
  const freqBits: string[] = [];
  if (streak >= 4) {
    freqPenalty += (streak - 3) * 5;
    freqBits.push(`${streak} dias seguidos treinando`);
  }
  if (last7 > targetFreq) {
    freqPenalty += (last7 - targetFreq) * 4;
    freqBits.push(`${last7} treinos em 7d (meta ${targetFreq})`);
  }
  freqPenalty = clamp(freqPenalty / (experienced ? 1.1 : 1), 0, 25);
  if (freqPenalty >= 3) {
    factors.push({
      key: "frequency",
      label: "Alta constância sem folga",
      detail: freqBits.join(" · "),
      impact: Math.round(freqPenalty),
    });
  }

  const lastSessionTs = sessions.length ? Math.max(...sessions.map((s) => new Date(s.started_at).getTime())) : null;
  const daysSinceLastTraining =
    lastSessionTs != null ? (now.getTime() - lastSessionTs) / 86_400_000 : null;

  // Continuous-day analysis: every day in the last 14 without a session
  // counts as "day without training". Used for advice + inactivity nudge.
  const WINDOW_DAYS = 14;
  const daysInWindow: { date: string; trained: boolean }[] = [];
  for (let i = 0; i < WINDOW_DAYS; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    daysInWindow.push({ date: key, trained: daysWithSession.has(key) });
  }
  const untrainedDaysInWindow = daysInWindow.filter((d) => !d.trained).length;
  // Consecutive untrained days ending today (excluding today if today has a session)
  let untrainedStreak = 0;
  for (const d of daysInWindow) {
    if (d.trained) break;
    untrainedStreak++;
  }

  // Inactivity factor: light penalty when the user has been inactive for
  // long enough that detraining/inconsistency matters. It's a small nudge,
  // not a large penalty — the goal is to influence advice, not to punish.
  let inactivityPenalty = 0;
  if (untrainedStreak >= 4) {
    inactivityPenalty = clamp((untrainedStreak - 3) * 3, 0, 12);
    factors.push({
      key: "inactivity",
      label: "Dias sem treinar",
      detail: `${untrainedStreak} dia${untrainedStreak === 1 ? "" : "s"} seguido${untrainedStreak === 1 ? "" : "s"} sem registrar treino`,
      impact: Math.round(inactivityPenalty),
    });
  } else if (daysSinceLastTraining != null && daysSinceLastTraining >= 2) {
    const dd = Math.floor(daysSinceLastTraining);
    factors.push({
      key: "rested",
      label: "Descansado",
      detail: `${dd} dia${dd === 1 ? "" : "s"} sem treinar`,
      impact: 0,
    });
  }


  const score = combinePenalties(factors.map((f) => f.impact));
  const status = scoreToStatus(score);
  const intensity = scoreToIntensity(score);

  const top = [...factors].filter((f) => f.impact > 0).sort((a, b) => b.impact - a.impact).slice(0, 3);

  const workedRecent = new Set(
    muscles.filter((m) => m.lastDaysAgo < 1.75 && m.setsRecent >= 3).map((m) => m.group),
  );
  const workedYesterday = new Set(
    muscles.filter((m) => m.lastDaysAgo < 2.5 && m.setsRecent >= 4).map((m) => m.group),
  );
  const untouched = muscles.filter((m) => m.lastDaysAgo >= 3).map((m) => m.group);

  const canonicalGroups = ["Peito", "Costas", "Ombros", "Bíceps", "Tríceps", "Pernas", "Glúteos", "Core"];
  const avoidBase = new Set<string>([...workedRecent]);
  if (score < 40) canonicalGroups.forEach((g) => avoidBase.add(g));
  else if (score < 60) workedYesterday.forEach((g) => avoidBase.add(g));

  const avoid = Array.from(avoidBase);
  const canDoRaw =
    score < 40
      ? ["Mobilidade", "Alongamento", "Caminhada leve"]
      : canonicalGroups.filter((g) => !avoidBase.has(g)).concat(untouched.filter((g) => !canonicalGroups.includes(g)));
  const canDo = Array.from(new Set(canDoRaw)).slice(0, 6);

  return {
    score, status, intensity, factors, top, muscles,
    workedRecent: Array.from(workedRecent),
    canDo, avoid,
    sleep: { last, avgHours: avgH, avgQuality: avgQ, nights: nights.length },
    cycle: c, streak, last7, sportMinutes48h, injuriesText, tolerance,
    daysSinceLastTraining,
    untrainedDaysInWindow,
    untrainedStreak,
    windowDays: WINDOW_DAYS,
  };
}


function buildFallbackNarrative(calc: ReturnType<typeof computeScore>): {
  headline: string; reason: string; recommendation: string; tip: string;
} {
  const { score, status, top, sleep, streak, cycle, daysSinceLastTraining, untrainedStreak, untrainedDaysInWindow, windowDays } = calc;
  const topStr = top.length > 0 ? top.map((f) => f.label.toLowerCase()).join(" + ") : "poucos sinais de fadiga";
  const restedLong = daysSinceLastTraining != null && daysSinceLastTraining >= 2;
  const longInactive = untrainedStreak >= 4;

  const headline =
    longInactive
      ? "Hora de voltar aos treinos"
      : status === "recuperado"
        ? restedLong ? "Descansado — bora treinar" : "Pronto pra treinar forte"
        : status === "leve" ? "Vá com moderação hoje"
        : status === "cuidado" ? "Cuide da recuperação"
        : "Priorize descanso hoje";

  const reasonBits: string[] = [`Score ${score}/100`];
  if (longInactive) reasonBits.push(`${untrainedStreak}d sem registrar treinos`);
  else if (restedLong) reasonBits.push(`${Math.floor(daysSinceLastTraining!)}d sem treinar`);
  if (top.length) reasonBits.push(`pesou: ${topStr}`);
  if (sleep.last) reasonBits.push(`últ. noite ${sleep.last.hours}h`);
  if (streak >= 4) reasonBits.push(`${streak}d seguidos`);
  if (!longInactive && untrainedDaysInWindow >= Math.ceil(windowDays * 0.7)) {
    reasonBits.push(`${untrainedDaysInWindow}/${windowDays}d sem treino`);
  }
  const reason = reasonBits.join(" · ") + ".";

  const recommendation =
    (longInactive ? "Retome com um treino leve pra reativar o corpo. " : "") +
    (!longInactive && restedLong && score >= 70 ? "Volte ao treino com carga normal — corpo recuperado. " : "") +
    calc.intensity.label +
    (calc.avoid.length && score < 70 ? ` · evite ${calc.avoid.slice(0, 3).join(", ")}` : "");

  let tip = "Hidrate bem e faça 5 min de mobilidade antes de começar.";
  if (longInactive) {
    tip = `${untrainedStreak} dias sem treino registrado. Que tal um alongamento leve ou uma caminhada de 20 min pra reativar o corpo?`;
  } else if (score < 40) tip = "Hoje é dia de recuperação: sono cedo, alongamento e proteína adequada.";
  else if (score < 60) {
    if (sleep.last && Number(sleep.last.hours) < 6.5) tip = "Meta pra hoje: dormir ≥ 8h e reduzir cafeína depois das 15h.";
    else if (streak >= 5) tip = "Encaixe 1 dia off nos próximos 2 — constância vira sobrecarga.";
    else tip = "Aumente o descanso entre séries em 20-30s e priorize técnica.";
  } else if (restedLong) {
    tip = "Aquecimento caprichado (5-8 min) antes das séries pesadas — corpo estava em pausa.";
  } else if (cycle && (cycle.isLatePhaseLutea || cycle.phaseLabel.toLowerCase() === "menstrual")) {
    tip = "Hidratação extra e magnésio à noite ajudam nessa fase.";
  }

  return { headline, reason, recommendation, tip };
}


/**
 * Shared entry point. Uses the caller's authenticated Supabase client so
 * RLS applies to reads. Never throws on AI failures — falls back to a
 * deterministic narrative.
 */
export async function computeRecoveryAdviceFor(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<RecoveryAdvice> {
  const now = new Date();
  const since = new Date(now.getTime() - 14 * 86_400_000);
  const sleepSince = new Date(now.getTime() - 7 * 86_400_000);

  const [{ data: profile }, { data: sessions }, { data: sleep }] = await Promise.all([
    supabase
      .from("profiles")
      .select("experience_level, uses_enhancers, birth_date, activity_level, injuries, weekly_frequency, sex, cycle_tracking_enabled, cycle_last_period_start, cycle_length_days, cycle_period_length_days")
      .eq("id", userId)
      .maybeSingle(),
    supabase
      .from("sessions")
      .select("started_at, ended_at, perceived_effort, session_sets(reps, weight_kg, rpe, exercises(name, muscle_group))")
      .eq("user_id", userId)
      .gte("started_at", since.toISOString())
      .order("started_at", { ascending: false })
      .limit(30),
    supabase
      .from("sleep_logs")
      .select("log_date, hours, quality")
      .eq("user_id", userId)
      .gte("log_date", sleepSince.toISOString().slice(0, 10))
      .order("log_date", { ascending: false }),
  ]);

  const sex = (profile as { sex?: string } | null)?.sex ?? null;
  const ignoredFactors: IgnoredFactor[] = [];
  if (sex && sex !== "feminino") {
    ignoredFactors.push({
      key: "cycle-sex",
      label: "Fase menstrual",
      reason: `Ignorada — perfil ${sex}.`,
    });
  } else if (sex === "feminino" && !profile?.cycle_tracking_enabled) {
    ignoredFactors.push({
      key: "cycle-off",
      label: "Fase menstrual",
      reason: "Ignorada — acompanhamento de ciclo desativado no perfil.",
    });
  }

  if ((!sessions || sessions.length === 0) && (!sleep || sleep.length === 0)) {
    return {
      status: "recuperado",
      score: 95,
      intensityPct: 100,
      intensityLabel: "Carga normal — pode progredir",
      headline: "Bora começar",
      reason: "Sem histórico ainda — corpo pronto para o primeiro treino.",
      recommendation: "Escolha um treino do plano e comece com carga moderada, focando técnica.",
      tip: "Anote o RPE de cada série pra IA começar a te calibrar.",
      canDo: ["Peito", "Costas", "Ombros", "Pernas", "Core"],
      avoid: [],
      factors: [],
      ignoredFactors,
    };
  }

  const { computeCyclePhase } = await import("./cycle");
  const cycle =
    profile?.cycle_tracking_enabled && sex === "feminino"
      ? computeCyclePhase({
          lastPeriodStart: profile.cycle_last_period_start,
          cycleLength: profile.cycle_length_days,
          periodLength: profile.cycle_period_length_days,
        })
      : null;

  const calc = computeScore({
    profile: (profile ?? null) as ProfileRow | null,
    sessions: (sessions ?? []) as SessionRow[],
    sleep: (sleep ?? []) as SleepRow[],
    now,
    cycle,
  });

  const fallback = buildFallbackNarrative(calc);

  let narrative = fallback;
  try {
    const { createConfiguredAiModel } = await import("./ai-gateway.server");
    const ai = createConfiguredAiModel({
      googleModel: "gemini-flash-latest",
      lovableModel: "google/gemini-3-flash-preview",
    });

    const NarrativeSchema = z.object({
      headline: z.string().max(60),
      reason: z.string().max(240),
      recommendation: z.string().max(240),
      tip: z.string().max(240),
    });

    const system = `Você é um coach de musculação em português brasileiro, direto e motivador.
Recebe o score de recuperação já calculado (0-100) e a lista de fatores que mais pesaram.
Sua tarefa é APENAS reescrever a narrativa em tom natural e humano, SEM inventar dados
que não estejam na estrutura. Cite números concretos (score, horas de sono, séries, dias
seguidos, fase do ciclo) quando aparecerem nos fatores.
Regras:
- headline: até 6 palavras, sem ponto final.
- reason: 1 frase citando os 2-3 fatores que mais impactaram e por quê.
- recommendation: 1-2 frases com intensidade sugerida ("~${calc.intensity.pct}%") e o que
  fazer/evitar hoje (grupos musculares se relevante).
- tip: 1 dica prática e proporcional ao score (${calc.score}). Quanto menor o score, mais
  específica/urgente (sono, hidratação, mobilidade, dia off).
Nunca contradiga o score, o status ou a intensidade recebidos.
- Se o usuário está há 2+ dias sem treinar E o score é ≥ 70, NÃO sugira "descanso"
  nem "priorize repouso" — ele já está descansado; oriente a voltar ao treino
  com carga normal.`;

    const prompt = `SCORE: ${calc.score}/100 (status: ${calc.status})
INTENSIDADE SUGERIDA: ${calc.intensity.label}
FATORES QUE MAIS PESARAM (impacto = pontos perdidos):
${calc.top.map((f) => `- ${f.label} (-${f.impact}pts): ${f.detail}`).join("\n") || "- nenhum fator relevante"}
FATORES ADICIONAIS:
${calc.factors.filter((f) => !calc.top.includes(f)).map((f) => `- ${f.label} (-${f.impact}): ${f.detail}`).join("\n") || "- —"}
DADOS-CHAVE:
- Sono: ${
      calc.sleep.last
        ? `última noite ${calc.sleep.last.hours}h${calc.sleep.last.quality ? ` (qualidade ${calc.sleep.last.quality}/5)` : ""}`
        : "sem registro"
    }${calc.sleep.avgHours != null ? ` · média ${calc.sleep.avgHours.toFixed(1)}h em ${calc.sleep.nights} noites` : ""}
- Dias desde o último treino: ${calc.daysSinceLastTraining != null ? calc.daysSinceLastTraining.toFixed(1) : "—"}
- Constância: ${calc.streak} dias seguidos · ${calc.last7} treinos em 7d
- Esporte nas últimas 48h: ${calc.sportMinutes48h} min
- Ciclo: ${calc.cycle ? `${calc.cycle.phaseLabel} (dia ${calc.cycle.dayInCycle}/${calc.cycle.cycleLength}${calc.cycle.isLatePhaseLutea ? " · TPM" : ""})` : "não acompanhado"}
- Lesão/limitação: ${calc.injuriesText || "nenhuma"}
- Pode fazer: ${calc.canDo.join(", ") || "—"}
- Evitar: ${calc.avoid.join(", ") || "—"}

Retorne JSON: { "headline": "...", "reason": "...", "recommendation": "...", "tip": "..." }`;

    const { output } = await generateText({
      model: ai.model,
      system,
      prompt,
      output: Output.object({ schema: NarrativeSchema }),
      maxRetries: 1,
    });
    narrative = output;
  } catch (error) {
    if (NoObjectGeneratedError.isInstance(error) && error.text) {
      const match = error.text.match(/\{[\s\S]*\}/);
      if (match) {
        try {
          const NarrativeSchema = z.object({
            headline: z.string().max(60),
            reason: z.string().max(240),
            recommendation: z.string().max(240),
            tip: z.string().max(240),
          });
          narrative = NarrativeSchema.parse(JSON.parse(match[0]));
        } catch {
          /* fica no fallback */
        }
      }
    } else {
      // log but do not throw — narrative fallback is always usable
      console.error("[recovery] AI narrative failed:", error instanceof Error ? error.message : error);
    }
  }

  return {
    status: calc.status,
    score: calc.score,
    intensityPct: calc.intensity.pct,
    intensityLabel: calc.intensity.label,
    headline: narrative.headline,
    reason: narrative.reason,
    recommendation: narrative.recommendation,
    tip: narrative.tip,
    canDo: calc.canDo,
    avoid: calc.avoid,
    factors: calc.factors,
    ignoredFactors,
  };
}
