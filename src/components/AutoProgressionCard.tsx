import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { TrendingUp, TrendingDown, Minus, Loader2, Sparkles, Check } from "lucide-react";
import { toast } from "sonner";
import {
  computeAutoProgression,
  applyAutoProgression,
  isAutoEnabled,
  setAutoEnabled,
  ranToday,
  markRanToday,
  type AutoAdjustment,
} from "@/lib/auto-progression";

const fmtKg = (n: number | null | undefined) =>
  n == null ? "—" : `${(Math.round(Number(n) * 10) / 10).toString().replace(".", ",")} kg`;

function DirIcon({ dir }: { dir: string }) {
  if (dir === "up") return <TrendingUp className="size-3.5 text-emerald-600" />;
  if (dir === "down") return <TrendingDown className="size-3.5 text-destructive" />;
  return <Minus className="size-3.5 text-muted-foreground" />;
}

/**
 * Progressão automática: revisa o desempenho recente + fadiga e ajusta
 * carga/descanso do plano inteiro. Pode rodar sozinho (1x por dia) quando
 * o usuário liga o modo automático.
 */
export function AutoProgressionCard({ userId }: { userId: string }) {
  const qc = useQueryClient();
  const [auto, setAuto] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => setAuto(isAutoEnabled(userId)), [userId]);

  const { data: adjustments = [], isLoading, refetch } = useQuery({
    queryKey: ["auto-progression", userId],
    queryFn: () => computeAutoProgression(userId),
    staleTime: 5 * 60 * 1000,
  });

  const apply = useMutation({
    mutationFn: async (list: AutoAdjustment[]) => applyAutoProgression(list),
    onSuccess: (n) => {
      markRanToday(userId);
      qc.invalidateQueries({ queryKey: ["workout-exercises"] });
      qc.invalidateQueries({ queryKey: ["workouts"] });
      qc.invalidateQueries({ queryKey: ["auto-progression", userId] });
      setOpen(false);
      if (n > 0) toast.success(`Plano atualizado: ${n} ajuste${n === 1 ? "" : "s"} aplicado${n === 1 ? "" : "s"}.`);
      else toast.info("Nenhum ajuste aplicado.");
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao atualizar o plano"),
  });

  // Modo automático: aplica sozinho no máximo uma vez por dia.
  useEffect(() => {
    if (!auto || isLoading || adjustments.length === 0) return;
    if (ranToday(userId) || apply.isPending) return;
    markRanToday(userId);
    apply.mutate(adjustments);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auto, isLoading, adjustments, userId]);

  const summary = useMemo(() => {
    const up = adjustments.filter((a) => a.suggestion.loadDirection === "up").length;
    const down = adjustments.filter((a) => a.suggestion.loadDirection === "down").length;
    const rest = adjustments.filter((a) => a.patch.target_rest_seconds != null).length;
    return { up, down, rest };
  }, [adjustments]);

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
        </div>
        <div className="flex items-center gap-2">
          <Switch id="auto-prog" checked={auto} onCheckedChange={(v) => { setAuto(v); setAutoEnabled(userId, v); }} />
          <Label htmlFor="auto-prog" className="text-xs text-muted-foreground">Automático</Label>
        </div>
      </div>

      {adjustments.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          <Button size="sm" onClick={() => apply.mutate(adjustments)} disabled={apply.isPending}>
            {apply.isPending ? <><Loader2 className="size-3.5 animate-spin" /> Aplicando...</> : <><Check className="size-3.5" /> Atualizar plano</>}
          </Button>
          <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
            Ver ajustes
          </Button>
          <Button size="sm" variant="ghost" onClick={() => refetch()}>
            Recalcular
          </Button>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Ajustes sugeridos</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {adjustments.map((a) => (
              <div key={a.itemId} className="rounded-lg border p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-sm font-medium">{a.exerciseName}</p>
                  <DirIcon dir={a.suggestion.loadDirection} />
                </div>
                <p className="text-xs text-muted-foreground">{a.workoutName}</p>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
                  {a.patch.target_weight_kg !== undefined && (
                    <span>Carga: {fmtKg(a.currentWeight)} → <strong>{fmtKg(a.patch.target_weight_kg)}</strong></span>
                  )}
                  {a.patch.target_rest_seconds != null && (
                    <span>Descanso: {a.currentRest}s → <strong>{a.patch.target_rest_seconds}s</strong></span>
                  )}
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground">{a.suggestion.reason}</p>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button onClick={() => apply.mutate(adjustments)} disabled={apply.isPending}>
              {apply.isPending ? <><Loader2 className="size-3.5 animate-spin" /> Aplicando...</> : "Aplicar tudo"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
