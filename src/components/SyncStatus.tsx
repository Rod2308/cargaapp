import { useEffect, useState } from "react";
import { CloudOff, WifiOff } from "lucide-react";
import { getPendingCount, subscribe } from "@/lib/offline-queue";
import { useOnline } from "@/hooks/useOnline";

export function SyncStatus() {
  const [pending, setPending] = useState(0);
  const online = useOnline();

  useEffect(() => {
    let mounted = true;
    getPendingCount().then((n) => {
      if (mounted) setPending(n);
    });
    const unsub = subscribe(() => {
      getPendingCount().then((n) => {
        if (mounted) setPending(n);
      });
    });
    return () => {
      mounted = false;
      unsub();
    };
  }, []);

  // Only render anything when actually offline (verified by real network ping).
  if (online) return null;

  return (
    <>
      <div
        role="status"
        className="fixed inset-x-0 top-0 z-50 flex items-center justify-center gap-2 bg-amber-500 px-3 py-1.5 text-xs font-medium text-amber-950 shadow"
      >
        <WifiOff className="size-3.5" />
        <span>Você está offline — suas alterações serão salvas ao reconectar</span>
      </div>

      {pending > 0 && (
        <div
          className="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full border border-border/60 bg-background/95 px-3 py-1.5 text-xs font-medium shadow-lg backdrop-blur"
          aria-live="polite"
        >
          <CloudOff className="size-3.5 text-amber-500" />
          <span>
            {pending} alteraç{pending === 1 ? "ão" : "ões"} pendente{pending === 1 ? "" : "s"}
          </span>
        </div>
      )}
    </>
  );
}
