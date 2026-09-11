import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { format, subDays } from "date-fns";
import { toast } from "sonner";
import { Calendar as CalendarIcon, Dumbbell, Activity, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";
import { CardioSportForm } from "@/components/CardioSportForm";

const MAX_RETRO_DAYS = 90;

type ActivityMode = "musculacao" | "cardio" | null;

type Props = {
  userId: string;
  /** Custom trigger. If omitted, renders a default underline button. */
  trigger?: ReactNode;
  triggerLabel?: string;
  initialMode?: ActivityMode;
};

export function RetroWorkoutDialog({
  userId,
  trigger,
  triggerLabel = "Marcar treino esquecido",
  initialMode = null,
}: Props) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<ActivityMode>(initialMode);

  const todayStr = useMemo(() => format(new Date(), "yyyy-MM-dd"), []);
  const yesterdayStr = useMemo(() => format(subDays(new Date(), 1), "yyyy-MM-dd"), []);
  const minStr = useMemo(() => format(subDays(new Date(), MAX_RETRO_DAYS), "yyyy-MM-dd"), []);

  const [workoutId, setWorkoutId] = useState<string>("");
  const [dateStr, setDateStr] = useState<string>(yesterdayStr);
  const [confirmDup, setConfirmDup] = useState(false);

  const { data: workouts = [] } = useQuery({
    queryKey: ["workouts", userId],
    queryFn: async () => {
      const { data } = await supabase
        .from("workouts")
        .select("*")
        .eq("user_id", userId)
        .order("order_idx");
      return data ?? [];
    },
  });

  // Reset when opening
  useEffect(() => {
    if (open) {
      setMode(initialMode);
      setDateStr(yesterdayStr);
      setWorkoutId((prev) => prev || workouts[0]?.id || "");
      setConfirmDup(false);
    }
  }, [open, workouts, yesterdayStr, initialMode]);

  const create = useMutation({
    mutationFn: async ({ keepOpen }: { keepOpen: boolean }) => {
      if (!workoutId) throw new Error("Escolha um treino");
      if (!dateStr) throw new Error("Escolha uma data");
      if (dateStr > todayStr) throw new Error("Não é possível marcar treinos em datas futuras");
      if (dateStr < minStr) throw new Error(`Só é possível registrar treinos dos últimos ${MAX_RETRO_DAYS} dias`);

      // Duplicate check só quando o usuário NÃO escolheu "adicionar outro".
      if (!confirmDup && !keepOpen) {
        const dayStart = new Date(`${dateStr}T00:00:00`).toISOString();
        const dayEnd = new Date(`${dateStr}T23:59:59.999`).toISOString();
        const { data: existing } = await supabase
          .from("sessions")
          .select("id")
          .eq("user_id", userId)
          .gte("started_at", dayStart)
          .lte("started_at", dayEnd)
          .limit(1);
        if (existing && existing.length > 0) {
          throw new Error("__DUPLICATE__");
        }
      }

      const startedAt = new Date(`${dateStr}T12:00:00`);
      const endedAt = new Date(startedAt.getTime() + 60 * 60_000);
      const { data, error } = await supabase
        .from("sessions")
        .insert({
          user_id: userId,
          workout_id: workoutId,
          started_at: startedAt.toISOString(),
          ended_at: endedAt.toISOString(),
        })
        .select()
        .single();
      if (error) throw error;
      return { session: data, keepOpen };
    },
    onSuccess: ({ session, keepOpen }) => {
      toast.success(`Treino registrado em ${format(new Date(`${dateStr}T12:00:00`), "dd/MM/yyyy")}`);
      qc.invalidateQueries({ queryKey: ["recovery"] });
      qc.invalidateQueries({ queryKey: ["recent-sessions"] });
      qc.invalidateQueries({ queryKey: ["month-sessions"] });
      qc.invalidateQueries({ queryKey: ["history-sessions"] });
      qc.invalidateQueries({ queryKey: ["last7-sessions"] });
      setConfirmDup(false);
      if (keepOpen) {
        setWorkoutId("");
        return;
      }
      setOpen(false);
      setWorkoutId("");
      navigate({ to: "/app/sessao/$id/editar", params: { id: session.id } });
    },
    onError: (e: any) => {
      if (e?.message === "__DUPLICATE__") {
        setConfirmDup(true);
        toast.warning("Já existe um treino nesta data. Toque em Confirmar novamente para adicionar outro.");
        return;
      }
      toast.error(e.message);
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <button
            type="button"
            className="text-xs font-semibold text-foreground underline underline-offset-4 disabled:opacity-40"
          >
            {triggerLabel}
          </button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-md">
        {mode === null && (
          <div className="space-y-4">
            <DialogHeader>
              <DialogTitle className="text-lg">Marcar treino esquecido</DialogTitle>
            </DialogHeader>
            <p className="text-xs text-muted-foreground">
              O que você realizou? Escolha o tipo de atividade para registrar:
            </p>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 pt-1">
              <button
                type="button"
                onClick={() => setMode("musculacao")}
                className="card-lift flex flex-col items-start gap-2 p-4 text-left border border-border hover:border-primary/50 transition-all cursor-pointer"
              >
                <div className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary">
                  <Dumbbell className="size-5" />
                </div>
                <div>
                  <p className="font-display font-bold text-sm text-foreground">Musculação</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Treino da academia (A, B, C...)</p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setMode("cardio")}
                className="card-lift flex flex-col items-start gap-2 p-4 text-left border border-border hover:border-brand/50 transition-all cursor-pointer"
              >
                <div className="grid size-10 place-items-center rounded-xl bg-brand/20 text-brand-foreground">
                  <Activity className="size-5" />
                </div>
                <div>
                  <p className="font-display font-bold text-sm text-foreground">Cardio / Esporte</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Corrida, bike, esteira, futebol, etc.</p>
                </div>
              </button>
            </div>

            <DialogFooter className="pt-2">
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
            </DialogFooter>
          </div>
        )}

        {mode === "musculacao" && (
          <div>
            <DialogHeader>
              <div className="flex items-center justify-between">
                <DialogTitle>Marcar Musculação</DialogTitle>
                <button
                  type="button"
                  onClick={() => setMode(null)}
                  className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  <ArrowLeft className="size-3.5" />
                  Trocar tipo
                </button>
              </div>
            </DialogHeader>
            <div className="space-y-4 mt-3">
              <p className="text-xs text-muted-foreground">
                Registre um treino de musculação feito anteriormente. Em seguida você preenche as séries na tela de edição.
              </p>
              <div>
                <Label className="text-xs font-semibold">Treino *</Label>
                <Select
                  value={workoutId}
                  onValueChange={(v) => {
                    setWorkoutId(v);
                    setConfirmDup(false);
                  }}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Escolha um treino" />
                  </SelectTrigger>
                  <SelectContent className="max-h-72">
                    {workouts.map((w: any) => (
                      <SelectItem key={w.id} value={w.id}>
                        {w.label} · {w.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs font-semibold">Data do treino *</Label>
                <Input
                  type="date"
                  value={dateStr}
                  min={minStr}
                  max={todayStr}
                  onChange={(e) => {
                    setDateStr(e.target.value);
                    setConfirmDup(false);
                  }}
                  className="mt-1"
                />
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Até {MAX_RETRO_DAYS} dias atrás. Datas futuras não são permitidas.
                </p>
              </div>
              {confirmDup && (
                <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-200">
                  Já existe um treino registrado nesta data. Toque em <strong>Confirmar mesmo assim</strong> para adicionar outro.
                </div>
              )}
            </div>
            <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-end mt-4 pt-2">
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button
                variant="secondary"
                onClick={() => create.mutate({ keepOpen: true })}
                disabled={create.isPending || !workoutId || confirmDup}
                title="Registra e mantém o diálogo aberto para adicionar outro treino"
              >
                Salvar e adicionar outro
              </Button>
              <Button
                onClick={() => create.mutate({ keepOpen: false })}
                disabled={create.isPending || !workoutId}
                className="gap-2 font-semibold"
              >
                <CalendarIcon className="size-4" />
                {confirmDup ? "Confirmar mesmo assim" : "Marcar como concluído"}
              </Button>
            </DialogFooter>
          </div>
        )}

        {mode === "cardio" && (
          <div>
            <DialogHeader>
              <DialogTitle>Registrar Cardio / Esporte</DialogTitle>
            </DialogHeader>
            <div className="mt-3">
              <CardioSportForm
                userId={userId}
                defaultDate={dateStr || yesterdayStr}
                onBack={() => setMode(null)}
                onSuccess={() => setOpen(false)}
                onCancel={() => setOpen(false)}
              />
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

