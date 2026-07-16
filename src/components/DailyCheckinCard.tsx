import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ClipboardCheck } from "lucide-react";
import { z } from "zod";

const checkinSchema = z.object({
  sleep_hours: z.number().min(0).max(24),
  sleep_quality: z.number().int().min(1).max(5),
  soreness: z.number().int().min(1).max(5),
  energy: z.number().int().min(1).max(5),
});

export function DailyCheckinCard({
  userId,
  todayStr,
  initial,
}: {
  userId: string;
  todayStr: string;
  initial?: {
    sleep_hours: number;
    sleep_quality: number;
    soreness: number;
    energy: number;
  } | null;
}) {
  const qc = useQueryClient();
  const [sleepHours, setSleepHours] = useState<string>(initial?.sleep_hours?.toString() ?? "7.5");
  const [sleepQuality, setSleepQuality] = useState<number>(initial?.sleep_quality ?? 4);
  const [soreness, setSoreness] = useState<number>(initial?.soreness ?? 2);
  const [energy, setEnergy] = useState<number>(initial?.energy ?? 4);

  const save = useMutation({
    mutationFn: async () => {
      const parsed = checkinSchema.safeParse({
        sleep_hours: Number(sleepHours),
        sleep_quality: sleepQuality,
        soreness,
        energy,
      });
      if (!parsed.success) {
        throw new Error(parsed.error.issues[0]?.message ?? "Dados inválidos");
      }
      const { error } = await supabase
        .from("daily_checkins")
        .upsert(
          { user_id: userId, log_date: todayStr, ...parsed.data },
          { onConflict: "user_id,log_date" },
        );
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(initial ? "Check-in atualizado" : "Check-in salvo!");
      qc.invalidateQueries({ queryKey: ["daily-checkin"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao salvar"),
  });

  const Stars = ({
    value,
    onChange,
    invert,
  }: {
    value: number;
    onChange: (v: number) => void;
    invert?: boolean;
  }) => (
    <div className="mt-1 flex gap-1.5">
      {[1, 2, 3, 4, 5].map((n) => {
        const active = n <= value;
        const color = invert
          ? active
            ? n >= 4
              ? "bg-destructive text-destructive-foreground border-destructive"
              : n >= 3
                ? "bg-amber-500 text-white border-amber-500"
                : "bg-emerald-500 text-white border-emerald-500"
            : "bg-background border-border text-muted-foreground"
          : active
            ? n >= 4
              ? "bg-emerald-500 text-white border-emerald-500"
              : n >= 3
                ? "bg-amber-500 text-white border-amber-500"
                : "bg-destructive text-destructive-foreground border-destructive"
            : "bg-background border-border text-muted-foreground";
        return (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            className={`h-10 flex-1 rounded-md border text-sm font-semibold transition ${color}`}
          >
            {n}
          </button>
        );
      })}
    </div>
  );

  return (
    <div className="card-lift relative mt-3 overflow-hidden p-4 sm:p-5">
      <span className="absolute inset-y-0 left-0 w-1 bg-brand" aria-hidden />
      <div className="flex items-start gap-3 pl-2">
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-brand/20 text-foreground">
          <ClipboardCheck className="size-4" strokeWidth={2.5} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-eyebrow uppercase text-muted-foreground">Check-in de hoje</p>
          <p className="mt-1 font-display text-base leading-snug text-foreground sm:text-lg">
            {initial ? "Ajuste seu check-in de hoje" : "Como você está hoje?"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            4 respostas rápidas para calcular a sugestão do dia.
          </p>

          <div className="mt-4 grid gap-4">
            <div>
              <Label className="text-xs">Horas de sono na última noite</Label>
              <Input
                type="number"
                step="0.5"
                min={0}
                max={24}
                value={sleepHours}
                onChange={(e) => setSleepHours(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-xs">Qualidade do sono</Label>
              <Stars value={sleepQuality} onChange={setSleepQuality} />
            </div>
            <div>
              <Label className="text-xs">Dor muscular hoje (1 = nenhuma, 5 = muita)</Label>
              <Stars value={soreness} onChange={setSoreness} invert />
            </div>
            <div>
              <Label className="text-xs">Energia / disposição</Label>
              <Stars value={energy} onChange={setEnergy} />
            </div>
          </div>

          <Button
            onClick={() => save.mutate()}
            disabled={save.isPending}
            className="mt-4 w-full sm:w-auto"
          >
            {save.isPending ? "Salvando..." : initial ? "Atualizar check-in" : "Salvar check-in"}
          </Button>
        </div>
      </div>
    </div>
  );
}
