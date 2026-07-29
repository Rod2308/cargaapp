import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Route as AuthedRoute } from "./route";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Plus, Trash2, ChevronRight, Dumbbell } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { CardioRecoveryAlert } from "@/components/CardioRecoveryAlert";
import { ImportWorkoutPlanDialog } from "@/components/ImportWorkoutPlanDialog";
import { EmptyState } from "@/components/EmptyState";
import { GridSkeleton } from "@/components/LoadingState";

export const Route = createFileRoute("/_authenticated/app/treinos/")({
  component: TreinosList,
});

function TreinosList() {
  const { user } = AuthedRoute.useRouteContext();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("A");
  const [name, setName] = useState("");

  const { data: workouts = [], isLoading } = useQuery({
    queryKey: ["workouts", user.id],
    queryFn: async () => {
      const { data } = await supabase.from("workouts").select("*").eq("user_id", user.id).order("order_idx");
      return data ?? [];
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      const { writeInsert } = await import("@/lib/offline-writes");
      return await writeInsert("workouts", {
        user_id: user.id,
        label,
        name,
        order_idx: workouts.length,
      });
    },
    onSuccess: (w: any) => {
      qc.setQueryData<any[]>(["workouts", user.id], (old = []) => [...old, w]);
      qc.invalidateQueries({ queryKey: ["workouts"] });
      setOpen(false);
      setName("");
      navigate({ to: "/app/treinos/$id", params: { id: w.id }, search: { add: 1 } });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      // Snapshot do treino + exercícios para permitir "Desfazer".
      const workout = ((qc.getQueryData<any[]>(["workouts", user.id]) ?? []) as any[]).find((w) => w.id === id);
      const { data: items } = await supabase.from("workout_exercises").select("*").eq("workout_id", id);
      const { writeDelete } = await import("@/lib/offline-writes");
      await writeDelete("workouts", { id });
      return { workout: workout ?? null, items: items ?? [] };
    },
    onMutate: async (id: string) => {
      await qc.cancelQueries({ queryKey: ["workouts", user.id] });
      const prev = qc.getQueryData<any[]>(["workouts", user.id]);
      qc.setQueryData<any[]>(["workouts", user.id], (old = []) => old.filter((w) => w.id !== id));
      return { prev };
    },
    onError: (_e, _id, ctx: any) => {
      if (ctx?.prev) qc.setQueryData(["workouts", user.id], ctx.prev);
    },
    onSuccess: (snap: any) => {
      qc.invalidateQueries({ queryKey: ["workouts"] });
      toastUndo({
        message: "Treino excluído",
        description: snap?.workout ? `${snap.workout.label} · ${snap.workout.name}` : undefined,
        onUndo: async () => {
          if (!snap?.workout) throw new Error("Não há dados para restaurar");
          const { error } = await supabase.from("workouts").insert(stripGenerated(snap.workout) as any);
          if (error) throw error;
          if (snap.items.length) {
            const { error: e2 } = await supabase
              .from("workout_exercises")
              .insert(snap.items.map((it: any) => stripGenerated(it)) as any);
            if (e2) throw e2;
          }
        },
        onRestored: () => qc.invalidateQueries({ queryKey: ["workouts"] }),
      });
    },
  });


  return (
    <div className="app-container pt-8">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Meus treinos</h1>
          <p className="mt-1 text-sm text-muted-foreground">Suas divisões A, B, C...</p>
        </div>
        <div className="flex gap-2">
        <ImportWorkoutPlanDialog userId={user.id} />
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline"><Plus className="size-4" /> Novo</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Novo treino</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="grid grid-cols-[80px_1fr] gap-3">
                <div className="space-y-1.5">
                  <Label>Letra</Label>
                  <Input maxLength={3} value={label} onChange={(e) => setLabel(e.target.value.toUpperCase())} />
                </div>
                <div className="space-y-1.5">
                  <Label>Nome</Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Peito e tríceps" />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={() => create.mutate()} disabled={!name || create.isPending}>Criar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        </div>
      </header>

      <div className="mt-5">
        <CardioRecoveryAlert userId={user.id} />
      </div>

      {isLoading ? (
        <div className="mt-5">
          <GridSkeleton count={4} itemHeight="h-24" />
        </div>
      ) : workouts.length === 0 ? (
        <EmptyState
          className="mt-5"
          icon={Dumbbell}
          title="Nenhum treino ainda"
          message="Toque em Novo para criar seu primeiro treino."
        />
      ) : (
      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {workouts.map((w) => (
          <div key={w.id} className="card-soft flex items-center gap-3 p-4">
            <span className="inline-flex size-11 items-center justify-center rounded-xl bg-primary text-lg font-bold text-primary-foreground">
              {w.label}
            </span>
            <Link to="/app/treinos/$id" params={{ id: w.id }} className="min-w-0 flex-1">
              <p className="truncate font-semibold">{w.name}</p>
              {w.notes && <p className="truncate text-xs text-muted-foreground">{w.notes}</p>}
            </Link>
            <button
              onClick={() => {
                if (confirm(`Excluir treino "${w.name}"?`)) remove.mutate(w.id);
              }}
              className="grid size-9 place-items-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-destructive"
            >
              <Trash2 className="size-4" />
            </button>
            <Link to="/app/treinos/$id" params={{ id: w.id }} className="grid size-9 place-items-center rounded-lg text-muted-foreground hover:bg-secondary">
              <ChevronRight className="size-4" />
            </Link>
          </div>
        ))}
      </div>
      )}
    </div>
  );
}
