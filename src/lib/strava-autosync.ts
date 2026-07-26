/**
 * Preferência e agendamento da sincronização automática com o Strava.
 * Guardado localmente no dispositivo (por usuário) — sem backend.
 */
const KEY = "carga:strava:autosync";
const LAST_KEY = "carga:strava:autosync:last";

/** Intervalo mínimo entre sincronizações automáticas (ms). */
export const AUTO_SYNC_MIN_INTERVAL_MS = 15 * 60 * 1000;

export function isAutoSyncEnabled(): boolean {
  if (typeof window === "undefined") return false;
  try {
    // Padrão: ligado
    return window.localStorage.getItem(KEY) !== "off";
  } catch {
    return false;
  }
}

export function setAutoSyncEnabled(enabled: boolean) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, enabled ? "on" : "off");
  } catch {
    /* ignore */
  }
}

export function lastAutoSyncAt(): number {
  if (typeof window === "undefined") return 0;
  try {
    return Number(window.localStorage.getItem(LAST_KEY) ?? 0) || 0;
  } catch {
    return 0;
  }
}

export function markAutoSyncNow() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LAST_KEY, String(Date.now()));
  } catch {
    /* ignore */
  }
}

export function shouldAutoSync(): boolean {
  if (!isAutoSyncEnabled()) return false;
  return Date.now() - lastAutoSyncAt() >= AUTO_SYNC_MIN_INTERVAL_MS;
}
