// Fonte única de verdade para janelas semanais.
// A semana começa no DOMINGO 00:00 (horário local) e termina no sábado 23:59.

/** Domingo 00:00 local da semana que contém `d`. */
export function weekStart(d: Date = new Date()): Date {
  const s = new Date(d);
  s.setHours(0, 0, 0, 0);
  s.setDate(s.getDate() - s.getDay()); // getDay(): 0 = domingo
  return s;
}

/** Sábado 23:59:59.999 local da semana que contém `d`. */
export function weekEnd(d: Date = new Date()): Date {
  const e = weekStart(d);
  e.setDate(e.getDate() + 6);
  e.setHours(23, 59, 59, 999);
  return e;
}

/** Chave estável da semana (yyyy-mm-dd do domingo). */
export function weekKey(d: Date = new Date()): string {
  const s = weekStart(d);
  const mm = String(s.getMonth() + 1).padStart(2, "0");
  const dd = String(s.getDate()).padStart(2, "0");
  return `${s.getFullYear()}-${mm}-${dd}`;
}

/** true quando `date` cai na mesma semana civil de `ref`. */
export function isSameWeek(date: Date, ref: Date = new Date()): boolean {
  return date >= weekStart(ref) && date <= weekEnd(ref);
}
