import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Loader2, Link as LinkIcon, LinkIcon as LinkOff, RefreshCw, Zap, Download } from "lucide-react";
import {
  getStravaStatus,
  getStravaAuthorizeUrl,
  disconnectStrava,
  backfillStrava,
  ensureStravaWebhook,
  syncStravaLatest,
} from "@/lib/strava.functions";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export function StravaConnect() {
  const qc = useQueryClient();
  const statusFn = useServerFn(getStravaStatus);
  const authUrlFn = useServerFn(getStravaAuthorizeUrl);
  const disconnectFn = useServerFn(disconnectStrava);
  const backfillFn = useServerFn(backfillStrava);
  const ensureHookFn = useServerFn(ensureStravaWebhook);
  const syncLatestFn = useServerFn(syncStravaLatest);

  const { data, isLoading } = useQuery({
    queryKey: ["strava-status"],
    queryFn: () => statusFn(),
  });

  // Toast baseado no retorno do callback OAuth
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const s = params.get("strava");
    if (s === "ok") {
      toast.success("Strava conectado!");
      qc.invalidateQueries({ queryKey: ["strava-status"] });
      // Registra webhook global (idempotente) e faz backfill inicial
      ensureHookFn().catch(() => {});
      backfillFn({ data: { count: 30 } })
        .then((r) => {
          if (r.inserted > 0) toast.success(`${r.inserted} atividade(s) importada(s) do Strava`);
          qc.invalidateQueries({ queryKey: ["history-sessions"] });
          qc.invalidateQueries({ queryKey: ["recent-sessions"] });
        })
        .catch((e) => toast.error(e.message ?? "Falha no backfill"));
      params.delete("strava");
      const q = params.toString();
      window.history.replaceState({}, "", window.location.pathname + (q ? `?${q}` : ""));
    } else if (s === "error") {
      const reason = params.get("reason") ?? "";
      toast.error(`Falha ao conectar Strava${reason ? `: ${reason}` : ""}`);
      params.delete("strava");
      params.delete("reason");
      const q = params.toString();
      window.history.replaceState({}, "", window.location.pathname + (q ? `?${q}` : ""));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const connect = useMutation({
    mutationFn: async () => authUrlFn(),
    onSuccess: (r) => {
      window.location.href = r.url;
    },
    onError: (e: Error) => toast.error(e.message ?? "Falha ao iniciar OAuth"),
  });

  const disconnect = useMutation({
    mutationFn: () => disconnectFn(),
    onSuccess: () => {
      toast.success("Strava desconectado");
      qc.invalidateQueries({ queryKey: ["strava-status"] });
    },
    onError: (e: Error) => toast.error(e.message ?? "Falha ao desconectar"),
  });

  const sync = useMutation({
    mutationFn: () => backfillFn({ data: { count: 30 } }),
    onSuccess: (r) => {
      toast.success(`Sincronização: ${r.inserted} novo(s), ${r.updated} atualizado(s)`);
      qc.invalidateQueries({ queryKey: ["history-sessions"] });
      qc.invalidateQueries({ queryKey: ["recent-sessions"] });
      qc.invalidateQueries({ queryKey: ["month-sessions"] });
      qc.invalidateQueries({ queryKey: ["strava-status"] });
    },
    onError: (e: Error) => toast.error(e.message ?? "Falha ao sincronizar"),
  });

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center gap-2">
        <div className="flex size-9 items-center justify-center rounded-lg bg-orange-500/10 text-orange-500">
          <Zap className="size-5" />
        </div>
        <div className="flex-1">
          <p className="font-semibold">Strava</p>
          <p className="text-xs text-muted-foreground">
            {isLoading
              ? "Carregando..."
              : data?.connected
                ? `Conectado${data.lastSyncAt ? ` · última sync ${format(new Date(data.lastSyncAt), "d MMM HH:mm", { locale: ptBR })}` : ""}`
                : "Importe suas atividades automaticamente"}
          </p>
        </div>
      </div>

      {!isLoading && !data?.connected && (
        <Button
          className="mt-3 w-full"
          onClick={() => connect.mutate()}
          disabled={connect.isPending}
        >
          {connect.isPending ? <Loader2 className="size-4 animate-spin" /> : <LinkIcon className="size-4" />}
          Conectar Strava
        </Button>
      )}

      {!isLoading && data?.connected && (
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <Button variant="outline" className="flex-1" onClick={() => sync.mutate()} disabled={sync.isPending}>
            {sync.isPending ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
            Sincronizar últimas 30
          </Button>
          <Button
            variant="ghost"
            className="text-destructive hover:text-destructive"
            onClick={() => disconnect.mutate()}
            disabled={disconnect.isPending}
          >
            {disconnect.isPending ? <Loader2 className="size-4 animate-spin" /> : <LinkOff className="size-4" />}
            Desconectar
          </Button>
        </div>
      )}

      <p className="mt-2 text-[11px] text-muted-foreground">
        Novas atividades no Strava chegam aqui automaticamente em poucos segundos.
      </p>
    </div>
  );
}
