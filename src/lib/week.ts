// Fonte única de verdade para janelas semanais e chaves de data.
//
// Tudo é calculado no FUSO DO USUÁRIO (IANA timezone), não em UTC e não no
// fuso do servidor. Sem isso, um treino às 21h de sábado no Brasil (UTC-3)
// vira domingo em UTC e cai na semana errada.
//
// A semana começa no DOMINGO 00:00 (hora local do usuário).

const DAY_MS = 86_400_000;

/** Fuso do usuário: o informado, senão o do runtime, senão UTC. */
export function resolveTimeZone(tz?: string | null): string {
  if (tz) return tz;
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

const partsCache = new Map<string, Intl.DateTimeFormat>();

function formatter(tz: string): Intl.DateTimeFormat {
  let f = partsCache.get(tz);
  if (!f) {
    try {
      f = new Intl.DateTimeFormat("en-CA", {
        timeZone: tz,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      });
    } catch {
      f = new Intl.DateTimeFormat("en-CA", {
        timeZone: "UTC",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      });
    }
    partsCache.set(tz, f);
  }
  return f;
}

type Wall = { year: number; month: number; day: number; hour: number; minute: number; second: number };

function wallClock(d: Date, tz: string): Wall {
  const parts = formatter(tz).formatToParts(d);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour") % 24,
    minute: get("minute"),
    second: get("second"),
  };
}

/** Offset do fuso (ms) no instante `d`. */
function offsetMs(d: Date, tz: string): number {
  const w = wallClock(d, tz);
  const asUtc = Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute, w.second, d.getMilliseconds());
  return asUtc - d.getTime();
}

function toDate(input: Date | string | number): Date {
  return input instanceof Date ? input : new Date(input);
}

/** Data civil (yyyy-mm-dd) no fuso do usuário. */
export function localDateStr(input: Date | string | number = new Date(), tz?: string | null): string {
  const w = wallClock(toDate(input), resolveTimeZone(tz));
  return `${w.year}-${String(w.month).padStart(2, "0")}-${String(w.day).padStart(2, "0")}`;
}

/** Instante correspondente a 00:00 local do dia que contém `input`. */
export function startOfLocalDay(input: Date | string | number = new Date(), tz?: string | null): Date {
  const zone = resolveTimeZone(tz);
  const d = toDate(input);
  const w = wallClock(d, zone);
  const guess = Date.UTC(w.year, w.month - 1, w.day, 0, 0, 0, 0);
  // Corrige com o offset vigente (trata DST).
  const off = offsetMs(new Date(guess), zone);
  return new Date(guess - off);
}

/** Instante de 00:00 local de uma data civil yyyy-mm-dd. */
export function localDayStart(dateStr: string, tz?: string | null): Date {
  return startOfLocalDay(`${dateStr}T12:00:00Z`, tz);
}

/** Dia da semana local (0 = domingo). */
export function localWeekday(input: Date | string | number = new Date(), tz?: string | null): number {
  const w = wallClock(toDate(input), resolveTimeZone(tz));
  return new Date(Date.UTC(w.year, w.month - 1, w.day)).getUTCDay();
}

/** Domingo 00:00 (hora local do usuário) da semana que contém `d`. */
export function weekStart(d: Date | string | number = new Date(), tz?: string | null): Date {
  const zone = resolveTimeZone(tz);
  const dayStart = startOfLocalDay(d, zone);
  const dow = localWeekday(dayStart, zone);
  return startOfLocalDay(new Date(dayStart.getTime() - dow * DAY_MS), zone);
}

/** Sábado 23:59:59.999 (hora local) da semana que contém `d`. */
export function weekEnd(d: Date | string | number = new Date(), tz?: string | null): Date {
  const zone = resolveTimeZone(tz);
  const nextSunday = startOfLocalDay(new Date(weekStart(d, zone).getTime() + 7 * DAY_MS + DAY_MS / 2), zone);
  return new Date(nextSunday.getTime() - 1);
}

/** Chave estável da semana (yyyy-mm-dd do domingo, hora local). */
export function weekKey(d: Date | string | number = new Date(), tz?: string | null): string {
  return localDateStr(weekStart(d, tz), tz);
}

/** true quando `date` cai na mesma semana civil local de `ref`. */
export function isSameWeek(date: Date | string | number, ref: Date = new Date(), tz?: string | null): boolean {
  const t = toDate(date).getTime();
  return t >= weekStart(ref, tz).getTime() && t <= weekEnd(ref, tz).getTime();
}

/** Diferença em dias civis locais entre duas datas (a - b). */
export function localDaysBetween(a: Date | string | number, b: Date | string | number, tz?: string | null): number {
  const zone = resolveTimeZone(tz);
  const da = startOfLocalDay(a, zone).getTime();
  const db = startOfLocalDay(b, zone).getTime();
  return Math.round((da - db) / DAY_MS);
}
