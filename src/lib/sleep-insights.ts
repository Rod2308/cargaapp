import type { SleepRow } from "@/lib/recovery-core";
import { weekStart } from "@/lib/week";

const DAY = 86_400_000;

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

export { weekStart } from "@/lib/week";

export function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

export type SleepNight = {
  date: string;
  hours: number | null;
  quality: number | null;
};

export type SleepWeek = {
  start: string;
  end: string;
  nights: SleepNight[];
  logged: number;
  avgHours: number | null;
  avgQuality: number | null;
  shortNights: number;
  /** Penalidade estimada de sono no score de Recuperação (0–35). */
  penalty: number;
};

/**
 * Mesma fórmula usada pelo motor de Recuperação (`recovery-core`), aplicada a
 * uma janela de noites — para mostrar o impacto do sono semana a semana.
 */
export function estimateSleepPenalty(nights: SleepNight[]): { penalty: number; bits: string[] } {
  const logged = nights.filter((n) => n.hours != null);
  const last = logged.length ? logged[logged.length - 1] : null;
  const avgH = logged.length
    ? logged.reduce((a, n) => a + Number(n.hours), 0) / logged.length
    : null;
  const q = logged.filter((n) => n.quality != null);
  const avgQ = q.length ? q.reduce((a, n) => a + Number(n.quality), 0) / q.length : null;

  let penalty = 0;
  const bits: string[] = [];
  if (last && Number(last.hours) < 6) {
    penalty += (6 - Number(last.hours)) * 9;
    bits.push(`última noite ${last.hours}h`);
  }
  if (avgH != null && avgH < 6.5) {
    penalty += (6.5 - avgH) * 8;
    bits.push(`média ${avgH.toFixed(1)}h`);
  }
  if (avgQ != null && avgQ <= 2.5) {
    penalty += (2.5 - avgQ) * 6;
    bits.push(`qualidade ${avgQ.toFixed(1)}/5`);
  }
  if (!last && avgH == null) {
    penalty += 4;
    bits.push("sem registro");
  }
  return { penalty: Math.round(clamp(penalty, 0, 35)), bits };
}

/**
 * Agrupa o histórico de sono (fonte única: card "Sono de hoje") em semanas
 * completas de domingo a sábado, da mais recente para a mais antiga.
 */
export function buildSleepWeeks(rows: SleepRow[], weeks = 6, today = new Date()): SleepWeek[] {
  const byDate = new Map<string, SleepRow>();
  for (const r of rows) byDate.set(r.log_date, r);

  const firstSunday = weekStart(today);
  const out: SleepWeek[] = [];
  for (let w = 0; w < weeks; w++) {
    const start = new Date(firstSunday.getTime() - w * 7 * DAY);
    const nights: SleepNight[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(start.getTime() + i * DAY);
      const key = toDateKey(d);
      const row = byDate.get(key);
      nights.push({
        date: key,
        hours: row ? Number(row.hours) : null,
        quality: row?.quality == null ? null : Number(row.quality),
      });
    }
    const logged = nights.filter((n) => n.hours != null);
    const qual = logged.filter((n) => n.quality != null);
    out.push({
      start: toDateKey(start),
      end: toDateKey(new Date(start.getTime() + 6 * DAY)),
      nights,
      logged: logged.length,
      avgHours: logged.length
        ? logged.reduce((a, n) => a + Number(n.hours), 0) / logged.length
        : null,
      avgQuality: qual.length
        ? qual.reduce((a, n) => a + Number(n.quality), 0) / qual.length
        : null,
      shortNights: logged.filter((n) => Number(n.hours) < 7).length,
      penalty: estimateSleepPenalty(nights).penalty,
    });
  }
  return out;
}

export function sleepStatus(hours: number | null): {
  label: string;
  color: string;
  bar: string;
} {
  if (hours == null) return { label: "Sem registro", color: "text-muted-foreground", bar: "bg-muted" };
  if (hours < 6) return { label: "Pouco sono", color: "text-destructive", bar: "bg-destructive" };
  if (hours < 7) return { label: "Sono baixo", color: "text-amber-600", bar: "bg-amber-500" };
  if (hours <= 9) return { label: "Sono ideal", color: "text-emerald-600", bar: "bg-emerald-500" };
  return { label: "Muito sono", color: "text-brand", bar: "bg-brand" };
}
