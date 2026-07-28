import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { syncStravaLatest, getStravaStatus } from "@/lib/strava.functions";
import {
import { bridged } from "@/lib/server-bridge";
  AUTO_SYNC_MIN_INTERVAL_MS,
  markAutoSyncNow,
  shouldAutoSync,
} from "@/lib/strava-autosync";

/**
 * Sincroniza automaticamente as atividades do Strava:
 * - ao abrir o app;
 * - quando o app volta ao foco (respeitando o intervalo mínimo);
 * - periodicamente enquanto o app estiver aberto.
 * Silencioso: sem toasts, apenas atualiza as queries do histórico.
 */
export function useStravaAutoSync() {
  const qc = useQueryClient();
  const statusFn = bridged("strava.status", getStravaStatus);
  const syncFn = bridged("strava.sync", syncStravaLatest);
  const running = useRef(false);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (cancelled || running.current) return;
      if (!shouldAutoSync()) return;
      running.current = true;
      try {
        const status = await statusFn();
        if (!status?.connected) return;
        const r = await syncFn({ data: { scope: "today" } });
        markAutoSyncNow();
        if ((r?.inserted ?? 0) > 0 || (r?.updated ?? 0) > 0) {
          qc.invalidateQueries({ queryKey: ["history-sessions"] });
          qc.invalidateQueries({ queryKey: ["recent-sessions"] });
          qc.invalidateQueries({ queryKey: ["month-sessions"] });
          qc.invalidateQueries({ queryKey: ["strava-status"] });
          qc.invalidateQueries({ queryKey: ["recovery"] });
        }
      } catch {
        /* offline ou não conectado — ignora silenciosamente */
      } finally {
        running.current = false;
      }
    };

    void run();

    const onFocus = () => {
      if (document.visibilityState === "visible") void run();
    };
    document.addEventListener("visibilitychange", onFocus);
    window.addEventListener("online", onFocus);
    const timer = window.setInterval(() => void run(), AUTO_SYNC_MIN_INTERVAL_MS);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onFocus);
      window.removeEventListener("online", onFocus);
      window.clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
