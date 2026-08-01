// Fonte única para o início da semana no app: DOMINGO.
// Todos os cálculos semanais (volume, sono, streak, 1RM, cardio) usam isto.

/** Domingo (00:00 local) da semana da data informada. */
export function weekStart(d: Date): Date {
  const dow = d.getDay(); // 0 = domingo
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() - dow);
}

/** Sábado (23:59:59 local) da semana da data informada. */
export function weekEnd(d: Date): Date {
  const s = weekStart(d);
  return new Date(s.getFullYear(), s.getMonth(), s.getDate() + 6, 23, 59, 59, 999);
}

/** Chave estável da semana — data do domingo em YYYY-MM-DD. */
export function weekKey(d: Date): string {
  const s = weekStart(d);
  return `${s.getFullYear()}-${String(s.getMonth() + 1).padStart(2, "0")}-${String(
    s.getDate(),
  ).padStart(2, "0")}`;
}

/** Aceita "YYYY-MM-DD" ou ISO completo e devolve o domingo da semana. */
export function weekStartOf(dateStr: string): Date {
  const d = new Date(dateStr.length <= 10 ? `${dateStr}T12:00:00` : dateStr);
  return weekStart(d);
}
