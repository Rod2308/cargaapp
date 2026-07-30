import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, CloudOff, RefreshCw, Trash2, WifiOff } from "lucide-react";
import {
  getFailedOps,
  getPendingCount,
  subscribe,
  retryFailedOp,
  retryAllFailedOps,
  discardFailedOp,
  discardAllFailedOps,
  type FailedOp,
} from "@/lib/offline-queue";
import { useOnline } from "@/hooks/useOnline";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

const TABLE_LABEL: Record<string, string> = {
  sessions: "Sessão de treino",
  session_sets: "Série registrada",
  workouts: "Treino",
  workout_exercises: "Exercício do treino",
  messages: "Mensagem",
  group_messages: "Mensagem de grupo",
  daily_checkins: "Check-in diário",
  sleep_logs: "Registro de sono",
  body_measurements: "Medida corporal",
  profiles: "Perfil",
  exercises: "Exercício",
};

const KIND_LABEL: Record<FailedOp["kind"], string> = {
  insert: "criação",
  upsert: "salvamento",
  update: "edição",
  delete: "exclusão",
};

function describe(op: FailedOp) {
  return `${TABLE_LABEL[op.table] ?? op.table} — ${KIND_LABEL[op.kind]}`;
}

export function SyncStatus() {
  const [pending, setPending] = useState(0);
  const [failed, setFailed] = useState<FailedOp[]>([]);
  const [open, setOpen] = useState(false);
  const online = useOnline();

  const refresh = useCallback(() => {
    void getPendingCount().then(setPending);
    void getFailedOps().then(setFailed);
  }, []);

  useEffect(() => {
    let mounted = true;
    const run = () => {
      if (!mounted) return;
      refresh();
    };
    run();
    const unsub = subscribe(run);
    return () => {
      mounted = false;
      unsub();
    };
  }, [refresh]);

  return (
    <>
      {!online && (
        <div
          role="status"
          className="fixed inset-x-0 top-0 z-50 flex items-center justify-center gap-2 bg-amber-500 px-3 py-1.5 text-xs font-medium text-amber-950 shadow"
        >
          <WifiOff className="size-3.5" />
          <span>Você está offline — suas alterações serão salvas ao reconectar</span>
        </div>
      )}

      {!online && pending > 0 && (
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

      {failed.length > 0 && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="fixed bottom-20 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full border border-destructive/40 bg-destructive/10 px-3 py-1.5 text-xs font-medium text-destructive shadow-lg backdrop-blur"
          aria-live="polite"
        >
          <AlertTriangle className="size-3.5" />
          <span>
            {failed.length} alteraç{failed.length === 1 ? "ão" : "ões"} não sincroniz
            {failed.length === 1 ? "ou" : "aram"}
          </span>
        </button>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Alterações não sincronizadas</DialogTitle>
            <DialogDescription>
              O servidor recusou estas alterações. Você pode tentar de novo ou descartá-las.
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-72 space-y-2 overflow-y-auto">
            {failed.map((op) => (
              <div key={op.id} className="rounded-lg border border-border/60 p-3 text-xs">
                <div className="font-medium">{describe(op)}</div>
                <div className="mt-0.5 text-muted-foreground">
                  {new Date(op.failedAt).toLocaleString("pt-BR")}
                </div>
                <div className="mt-1 break-words text-destructive">{op.error}</div>
                <div className="mt-2 flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => void retryFailedOp(op.id)}>
                    <RefreshCw className="mr-1 size-3" /> Tentar de novo
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => void discardFailedOp(op.id)}>
                    <Trash2 className="mr-1 size-3" /> Descartar
                  </Button>
                </div>
              </div>
            ))}
            {failed.length === 0 && (
              <p className="text-sm text-muted-foreground">Nada pendente de revisão.</p>
            )}
          </div>

          {failed.length > 1 && (
            <div className="flex gap-2">
              <Button className="flex-1" onClick={() => void retryAllFailedOps()}>
                Tentar todas
              </Button>
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => void discardAllFailedOps()}
              >
                Descartar todas
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
