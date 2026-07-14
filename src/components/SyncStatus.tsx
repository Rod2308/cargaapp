import { useEffect, useRef, useState } from "react";
import { CloudOff, RefreshCw, Check, WifiOff } from "lucide-react";
import { flush, getPendingCount, subscribe } from "@/lib/offline-queue";

export function SyncStatus() {
  const [pending, setPending] = useState(0);
  const [online, setOnline] = useState(
    typeof navigator === "undefined" ? true : navigator.onLine,
  );
  const [justSynced, setJustSynced] = useState(false);
  const wasOfflineRef = useRef(false);
  const hadPendingRef = useRef(false);

  useEffect(() => {
    let mounted = true;
    getPendingCount().then((n) => {
      if (!mounted) return;
      setPending(n);
      hadPendingRef.current = n > 0;
    });
    const unsub = subscribe(() => {
      getPendingCount().then((n) => {
        if (!mounted) return;
        setPending((prev) => {
          // Queue drained to 0 while online → show "Sincronizado"
          if (prev > 0 && n === 0 && (typeof navigator === "undefined" || navigator.onLine)) {
            setJustSynced(true);
            window.setTimeout(() => setJustSynced(false), 2800);
          }
          return n;
        });
      });
    });
    const on = () => {
      setOnline(true);
      if (wasOfflineRef.current) {
        // Coming back online — if no pending, show synced confirmation
        wasOfflineRef.current = false;
        if (!hadPendingRef.current) {
          setJustSynced(true);
          window.setTimeout(() => setJustSynced(false), 2800);
        }
      }
    };
    const off = () => {
      setOnline(false);
      wasOfflineRef.current = true;
      setJustSynced(false);
    };
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      mounted = false;
      unsub();
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  useEffect(() => {
    hadPendingRef.current = pending > 0;
  }, [pending]);

  return (
    <>
      {/* Top banner: hard offline state */}
      {!online && (
        <div
          role="status"
          className="fixed inset-x-0 top-0 z-50 flex items-center justify-center gap-2 bg-amber-500 px-3 py-1.5 text-xs font-medium text-amber-950 shadow"
        >
          <WifiOff className="size-3.5" />
          <span>Você está offline — suas alterações serão salvas ao reconectar</span>
        </div>
      )}

      {/* Bottom pill: pending queue / syncing / just synced */}
      {(pending > 0 || justSynced) && (
        <button
          onClick={() => void flush()}
          className="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full border border-border/60 bg-background/95 px-3 py-1.5 text-xs font-medium shadow-lg backdrop-blur"
          aria-live="polite"
        >
          {justSynced ? (
            <>
              <Check className="size-3.5 text-emerald-500" />
              <span>Sincronizado</span>
            </>
          ) : !online ? (
            <>
              <CloudOff className="size-3.5 text-amber-500" />
              <span>
                {pending} alteraç{pending === 1 ? "ão" : "ões"} pendente{pending === 1 ? "" : "s"}
              </span>
            </>
          ) : (
            <>
              <RefreshCw className="size-3.5 animate-spin text-primary" />
              <span>
                Sincronizando {pending} alteraç{pending === 1 ? "ão" : "ões"}…
              </span>
            </>
          )}
        </button>
      )}
    </>
  );
}
