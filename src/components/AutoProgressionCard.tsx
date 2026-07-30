import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Loader2,
  Sparkles,
  Check,
  AlertTriangle,
  History,
  RotateCcw,
} from "lucide-react";
import { toast } from "sonner";
import {
  computeAutoProgression,
  applyAutoProgression,
  isAutoEnabled,
  setAutoEnabled,
  ranToday,
  markRanToday,
  adjustmentImpact,
  splitByConfirmation,
  buildEvidence,
  type AutoAdjustment,
} from "@/lib/auto-progression";
import { listPlanVersions, restorePlanVersion } from "@/lib/plan-versions";

const fmtKg = (n: number | null | undefined) =>
  n == null ? "—" : `${(Math.round(Number(n) * 10) / 10).toString().replace(".", ",")} kg`;

function DirIcon({ dir }: { dir: string }) {
  if (dir === "up") return <TrendingUp className="size-3.5 text-emerald-600" />;
  if (dir === "down") return <TrendingDown className="size-3.5 text-destructive" />;
  return <Minus className="size-3.5 text-muted-foreground" />;
}

/** Detalhe de um ajuste: o que muda, por quê e com quais dados. */
function AdjustmentRow({
  a,
  selectable,
  checked,
  onCheckedChange,
}: {
  a: AutoAdjustment;
  selectable?: boolean;
  checked?: boolean;
  onCheckedChange?: (v: boolean) => void;
}) {
  const impact = adjustmentImpact(a);
  const evidence = buildEvidence(a);
  return (
    <div className="rounded-lg border p-3">
      <div className="flex items-start gap-2">
        {selectable && (
          <Checkbox
            className="mt-0.5"
            checked={!!checked}
            onCheckedChange={(v) => onCheckedChange?.(v === true)}
            aria-label={`Confirmar ajuste de ${a.exerciseName}`}
          />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="truncate text-sm font-medium">{a.exerciseName}</p>
            <div className="flex shrink-0 items-center gap-1">
              {impact.isReduction && (
                <Badge variant="destructive" className="text-[10px]">Redução</Badge>
              )}
              {impact.isBig && !impact.isReduction && (
                <Badge variant="secondary" className="text-[10px]">Ajuste grande</Badge>
              )}
              <DirIcon dir={a.suggestion.loadDirection} />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">{a.workoutName}</p>

          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
            {a.patch.target_weight_kg !== undefined && (
              <span>
                Carga: {fmtKg(a.currentWeight)} → <strong>{fmtKg(a.patch.target_weight_kg)}</strong>
                {impact.loadDeltaPct != null && (
                  <span className="text-muted-foreground">
                    {" "}({impact.loadDeltaPct > 0 ? "+" : ""}
                    {Math.round(impact.loadDeltaPct * 100)}%)
                  </span>
                )}
              </span>
            )}
            {a.patch.target_rest_seconds != null && (
              <span>
                Descanso: {a.currentRest}s → <strong>{a.patch.target_rest_seconds}s</strong>
              </span>
            )}
          </div>

          <p className="mt-2 text-[11px] font-medium">Por que mudou</p>
          <p className="text-[11px] text-muted-foreground">{a.suggestion.reason}</p>

          <p className="mt-2 text-[11px] font-medium">Desempenho e fadiga usados</p>
          <ul className="mt-0.5 space-y-0.5 text-[11px] text-muted-foreground">
            {evidence.map((e, i) => (
              <li key={i}>• {e}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

/**
 * Progressão automática: revisa o desempenho recente + fadiga e ajusta
 * carga/descanso do plano inteiro. Reduções e ajustes grandes só são
 * aplicados após confirmação explícita do usuário.
 */
export function AutoProgressionCard({ userId }: { userId: string }) {
  const qc = useQueryClient();
  const [auto, setAuto] = useState(false);
  const [open, setOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [versionsOpen, setVersionsOpen] = useState(false);
  const [selected, setSelected] = useState<Record<string, boolean>>({});

  useEffect(() => setAuto(isAutoEnabled(userId)), [userId]);

  const { data: adjustments = [], isLoading, refetch } = useQuery({
    queryKey: ["auto-progression", userId],
    queryFn: () => computeAutoProgression(userId),
    staleTime: 5 * 60 * 1000,
  });

  const { data: versions = [] } = useQuery({
    queryKey: ["plan-versions", userId],
    queryFn: () => listPlanVersions(userId),
    staleTime: 60 * 1000,
  });

  const { auto: safeAdjustments, needsConfirmation } = useMemo(
    () => splitByConfirmation(adjustments),
    [adjustments],
  );

  // Ao abrir a confirmação, começa com tudo marcado.
  useEffect(() => {
    if (confirmOpen) {
      setSelected(Object.fromEntries(needsConfirmation.map((a) => [a.itemId, true])));
    }
  }, [confirmOpen, needsConfirmation]);

  const restore = useMutation({
    mutationFn: async (versionId: string) => restorePlanVersion(userId, versionId),
    onSuccess: (n) => {
      qc.invalidateQueries({ queryKey: ["workout-exercises"] });
      qc.invalidateQueries({ queryKey: ["workouts"] });
      qc.invalidateQueries({ queryKey: ["auto-progression", userId] });
      qc.invalidateQueries({ queryKey: ["plan-versions", userId] });
      toast.success(`Plano restaurado: ${n} exercício(s) voltaram aos valores anteriores.`);
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao restaurar a versão"),
  });

  const apply = useMutation({
    mutationFn: async (list: AutoAdjustment[]) =>
      applyAutoProgression(list, { userId }),
    onSuccess: ({ applied, versionId }) => {
      markRanToday(userId);
      qc.invalidateQueries({ queryKey: ["workout-exercises"] });
      qc.invalidateQueries({ queryKey: ["workouts"] });
      qc.invalidateQueries({ queryKey: ["auto-progression", userId] });
      qc.invalidateQueries({ queryKey: ["plan-versions", userId] });
      setOpen(false);
      setConfirmOpen(false);
      if (applied > 0) {
        toast.success(
          `Plano atualizado: ${applied} ajuste${applied === 1 ? "" : "s"} aplicado${applied === 1 ? "" : "s"}.`,
          versionId
            ? {
                duration: 20000,
                description: "Não gostou? Você pode desfazer esta atualização.",
                action: { label: "Desfazer", onClick: () => restore.mutate(versionId) },
              }
            : undefined,
        );
      } else toast.info("Nenhum ajuste aplicado.");
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao atualizar o plano"),
  });

  /** Aplica os ajustes seguros e pede confirmação para reduções/ajustes grandes. */
  function applySafeAndAsk() {
    if (safeAdjustments.length > 0) apply.mutate(safeAdjustments);
    if (needsConfirmation.length > 0) setConfirmOpen(true);
  }

  // Modo automático: aplica sozinho (1x/dia) somente o que não exige confirmação.
  useEffect(() => {
    if (!auto || isLoading || adjustments.length === 0) return;
    if (ranToday(userId) || apply.isPending) return;
    markRanToday(userId);
    if (safeAdjustments.length > 0) apply.mutate(safeAdjustments);
    if (needsConfirmation.length > 0) {
      toast.warning(
        `${needsConfirmation.length} ajuste(s) precisam da sua confirmação (redução ou mudança grande).`,
        { action: { label: "Revisar", onClick: () => setConfirmOpen(true) } },
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auto, isLoading, adjustments, userId]);

  const summary = useMemo(() => {
    const up = adjustments.filter((a) => a.suggestion.loadDirection === "up").length;
    const down = adjustments.filter((a) => a.suggestion.loadDirection === "down").length;
    const rest = adjustments.filter((a) => a.patch.target_rest_seconds != null).length;
    return { up, down, rest };
  }, [adjustments]);

  const selectedList = needsConfirmation.filter((a) => selected[a.itemId]);

  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <Sparkles className="size-4 text-primary" /> Progressão automática
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {isLoading
              ? "Analisando seu desempenho recente..."
              : adjustments.length === 0
                ? "Seu plano já está calibrado para o desempenho e a fadiga atuais."
                : `${adjustments.length} exercício(s) com ajuste sugerido · ${summary.up} aumentar, ${summary.down} reduzir, ${summary.rest} descanso.`}
          </p>
          {needsConfirmation.length > 0 && (
            <p className="mt-1 flex items-center gap-1 text-xs text-amber-600 dark:text-amber-500">
              <AlertTriangle className="size-3.5" />
              {needsConfirmation.length} ajuste(s) aguardam sua confirmação
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Switch id="auto-prog" checked={auto} onCheckedChange={(v) => { setAuto(v); setAutoEnabled(userId, v); }} />
          <Label htmlFor="auto-prog" className="text-xs text-muted-foreground">Automático</Label>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {adjustments.length > 0 && (
          <>
            <Button size="sm" onClick={applySafeAndAsk} disabled={apply.isPending}>
              {apply.isPending ? <><Loader2 className="size-3.5 animate-spin" /> Aplicando...</> : <><Check className="size-3.5" /> Atualizar plano</>}
            </Button>
            <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
              Ver ajustes
            </Button>
            <Button size="sm" variant="ghost" onClick={() => refetch()}>
              Recalcular
            </Button>
          </>
        )}
        {versions.length > 0 && (
          <Button size="sm" variant="ghost" onClick={() => setVersionsOpen(true)}>
            <History className="size-3.5" /> Versões do plano ({versions.length})
          </Button>
        )}
      </div>

      {/* Detalhamento completo */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Ajustes sugeridos</DialogTitle>
            <DialogDescription>
              Cada mudança mostra o motivo e os dados de desempenho e fadiga usados no cálculo.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {adjustments.map((a) => (
              <AdjustmentRow key={a.itemId} a={a} />
            ))}
          </div>
          <DialogFooter>
            <Button onClick={applySafeAndAsk} disabled={apply.isPending}>
              {apply.isPending ? (
                <><Loader2 className="size-3.5 animate-spin" /> Aplicando...</>
              ) : needsConfirmation.length > 0 ? (
                "Aplicar e revisar reduções"
              ) : (
                "Aplicar tudo"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmação obrigatória: reduções e ajustes grandes */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="size-4 text-amber-500" /> Confirmar mudanças maiores
            </DialogTitle>
            <DialogDescription>
              Estes ajustes reduzem carga ou mudam bastante o plano. Escolha quais você aceita.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {needsConfirmation.map((a) => (
              <AdjustmentRow
                key={a.itemId}
                a={a}
                selectable
                checked={!!selected[a.itemId]}
                onCheckedChange={(v) => setSelected((s) => ({ ...s, [a.itemId]: v }))}
              />
            ))}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setConfirmOpen(false)} disabled={apply.isPending}>
              Agora não
            </Button>
            <Button
              onClick={() => apply.mutate(selectedList)}
              disabled={apply.isPending || selectedList.length === 0}
            >
              {apply.isPending
                ? <><Loader2 className="size-3.5 animate-spin" /> Aplicando...</>
                : `Confirmar ${selectedList.length} ajuste(s)`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
