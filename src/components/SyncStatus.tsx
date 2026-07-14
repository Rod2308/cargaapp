import { useEffect, useState } from "react";
import { CloudOff, RefreshCw } from "lucide-react";
import { flush, getPendingCount, subscribe } from "@/lib/offline-queue";

export function SyncStatus() {
  const [pending, setPending] = useState(0);
  const [online, setOnline] = useState(
    typeof navigator === "undefined" ? true : navigator.onLine,
  );

  useEffect(() => {
    let mounted = true;
    getPendingCount().then((n) => mounted && setPending(n));
    const unsub = subscribe(() => {
      getPendingCount().then((n) => mounted && setPending(n));
    });
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      mounted = false;
      unsub();
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  if (online && pending === 0) return null;

  return (
    <button
      onClick={() => void flush()}
      className="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full border border-border/60 bg-background/95 px-3 py-1.5 text-xs font-medium shadow-lg backdrop-blur"
      aria-live="polite"
    >
      {!online ? (
        <>
          <CloudOff className="size-3.5 text-amber-500" />
          <span>Sem internet{pending > 0 ? ` — ${pending} pendente${pending === 1 ? "" : "s"}` : ""}</span>
        </>
      ) : (
        <>
          <RefreshCw className="size-3.5 animate-spin text-primary" />
          <span>Sincronizando {pending} alteraç{pending === 1 ? "ão" : "ões"}…</span>
        </>
      )}
    </button>
  );
}
