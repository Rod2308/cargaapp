import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Link as LinkIcon, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";

export function LinkToWorkoutButton({
  sessionId,
  userId,
  currentWorkoutId,
  currentWorkoutLabel,
}: {
  sessionId: string;
  userId: string;
  currentWorkoutId: string | null;
  currentWorkoutLabel?: string | null;
}) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: workouts = [] } = useQuery({
    enabled: open,
    queryKey: ["user-workouts-picker", userId],
    queryFn: async () => {
      const { data } = await supabase
        .from("workouts")
        .select("id, label, name")
        .eq("user_id", userId)
        .order("order_idx", { ascending: true });
      return data ?? [];
    },
  });

  const link = useMutation({
    mutationFn: async (workoutId: string | null) => {
      const { error } = await supabase.from("sessions").update({ workout_id: workoutId }).eq("id", sessionId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(currentWorkoutId ? "Vínculo atualizado" : "Vinculado ao plano");
      qc.invalidateQueries({ queryKey: ["history-sessions"] });
      qc.invalidateQueries({ queryKey: ["workout-recent-cardio"] });
      setOpen(false);
    },
    onError: (e: any) => toast.error(e.message ?? "Falha ao vincular"),
  });

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          size="sm"
          variant="outline"
          className={currentWorkoutId ? "text-primary hover:text-primary" : ""}
          title={currentWorkoutId ? `Vinculado: ${currentWorkoutLabel ?? "plano"}` : "Vincular ao plano"}
        >
          <LinkIcon className="size-3.5" />
          {currentWorkoutId ? "Vinculado" : "Vincular"}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-1" align="end">
        <div className="max-h-64 overflow-y-auto">
          {workouts.length === 0 ? (
            <p className="p-3 text-xs text-muted-foreground">Nenhum treino no plano ainda.</p>
          ) : (
            <>
              {workouts.map((w) => {
                const active = w.id === currentWorkoutId;
                return (
                  <button
                    key={w.id}
                    onClick={() => link.mutate(w.id)}
                    disabled={link.isPending}
                    className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm hover:bg-secondary disabled:opacity-50"
                  >
                    <span className="truncate">
                      {w.label ? `Treino ${w.label} — ` : ""}{w.name}
                    </span>
                    {active && <Check className="size-4 shrink-0 text-primary" />}
                  </button>
                );
              })}
              {currentWorkoutId && (
                <button
                  onClick={() => link.mutate(null)}
                  disabled={link.isPending}
                  className="mt-1 flex w-full items-center gap-2 rounded-md border-t border-border px-2 py-1.5 text-left text-xs text-muted-foreground hover:bg-secondary disabled:opacity-50"
                >
                  {link.isPending ? <Loader2 className="size-3 animate-spin" /> : null}
                  Remover vínculo
                </button>
              )}
            </>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
