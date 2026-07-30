// Streak de treinos e resumos semanal/mensal — cálculos puros.

export type SessionLite = { started_at: string; ended_at?: string | null };

const DAY = 86400000;

function localDayKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function dayKeyOf(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export type StreakInfo = {
  /** Dias consecutivos treinando (conta hoje ou ontem como início válido). */
  days: number;
  /** Semanas consecutivas com pelo menos um treino. */
  weeks: number;
  /** Maior sequência de dias já alcançada. */
  bestDays: number;
  /** True quando já treinou hoje. */
  trainedToday: boolean;
};

export function computeStreak(sessions: SessionLite[], now: Date = new Date()): StreakInfo {
  const days = new Set(sessions.map((s) => localDayKey(s.started_at)));
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const trainedToday = days.has(dayKeyOf(today));

  // Sequência atual: começa hoje se treinou hoje, senão ontem (dia ainda "vivo").
  let cursor = new Date(today);
  if (!trainedToday) cursor = new Date(today.getTime() - DAY);
  let current = 0;
  while (days.has(dayKeyOf(cursor))) {
    current += 1;
    cursor = new Date(cursor.getTime() - DAY);
  }

  // Melhor sequência histórica.
  const sorted = [...days].sort();
  let best = 0;
  let run = 0;
  let prev: Date | null = null;
  for (const key of sorted) {
    const [y, m, d] = key.split("-").map(Number);
    const date = new Date(y, m - 1, d);
    if (prev && Math.round((date.getTime() - prev.getTime()) / DAY) === 1) run += 1;
    else run = 1;
    best = Math.max(best, run);
    prev = date;
  }

  // Semanas consecutivas (segunda a domingo).
  const weekStart = (date: Date) => {
    const dow = (date.getDay() + 6) % 7; // 0 = segunda
    return new Date(date.getFullYear(), date.getMonth(), date.getDate() - dow);
  };
  const weekKeys = new Set(
    [...days].map((k) => {
      const [y, m, d] = k.split("-").map(Number);
      return dayKeyOf(weekStart(new Date(y, m - 1, d)));
    }),
  );
  let weeks = 0;
  let wCursor = weekStart(today);
  if (!weekKeys.has(dayKeyOf(wCursor))) wCursor = new Date(wCursor.getTime() - 7 * DAY);
  while (weekKeys.has(dayKeyOf(wCursor))) {
    weeks += 1;
    wCursor = new Date(wCursor.getTime() - 7 * DAY);
  }

  return { days: current, weeks, bestDays: Math.max(best, current), trainedToday };
}

export type PeriodSummary = {
  sessions: number;
  volume: number;
  sets: number;
  minutes: number;
};

export type PeriodComparison = {
  current: PeriodSummary;
  previous: PeriodSummary;
  deltaSessions: number;
  deltaVolumePct: number | null;
};

export type SetLite = {
  session_id: string;
  weight_kg: number | null;
  reps: number | null;
};

function summarize(
  sessions: (SessionLite & { id: string })[],
  setsBySession: Map<string, SetLite[]>,
  from: Date,
  to: Date,
): PeriodSummary {
  let volume = 0;
  let setCount = 0;
  let minutes = 0;
  let count = 0;
  for (const s of sessions) {
    const t = new Date(s.started_at).getTime();
    if (t < from.getTime() || t >= to.getTime()) continue;
    count += 1;
    if (s.ended_at) {
      minutes += Math.max(0, Math.round((new Date(s.ended_at).getTime() - t) / 60000));
    }
    for (const set of setsBySession.get(s.id) ?? []) {
      setCount += 1;
      volume += (set.weight_kg ?? 0) * (set.reps ?? 0);
    }
  }
  return { sessions: count, volume: Math.round(volume), sets: setCount, minutes };
}

/** Compara os últimos `days` dias com os `days` anteriores a eles. */
export function comparePeriods(
  sessions: (SessionLite & { id: string })[],
  sets: SetLite[],
  days: number,
  now: Date = new Date(),
): PeriodComparison {
  const bySession = new Map<string, SetLite[]>();
  for (const s of sets) {
    const list = bySession.get(s.session_id) ?? [];
    list.push(s);
    bySession.set(s.session_id, list);
  }
  const end = new Date(now.getTime());
  const midpoint = new Date(end.getTime() - days * DAY);
  const start = new Date(end.getTime() - 2 * days * DAY);

  const current = summarize(sessions, bySession, midpoint, end);
  const previous = summarize(sessions, bySession, start, midpoint);

  return {
    current,
    previous,
    deltaSessions: current.sessions - previous.sessions,
    deltaVolumePct:
      previous.volume > 0
        ? Math.round(((current.volume - previous.volume) / previous.volume) * 1000) / 10
        : null,
  };
}
