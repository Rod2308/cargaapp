import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getStudentDetails } from "@/lib/trainer.functions";
import { supabase } from "@/integrations/supabase/client";
import { Route as AuthedRoute } from "./route";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ArrowLeft, Plus, ChevronRight, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { ListSkeleton } from "@/components/LoadingState";
import { ImportWorkoutPlanDialog } from "@/components/ImportWorkoutPlanDialog";

export const Route = createFileRoute("/_authenticated/app/alunos/$id")({
  beforeLoad: ({ context }) => {
    if (!context.isTrainer) throw redirect({ to: "/app" });
  },
  component: AlunoDetail,
});

function AlunoDetail() {
  const { user } = AuthedRoute.useRouteContext();
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const getDetails = useServerFn(getStudentDetails);
  const [manualOpen, setManualOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["student", id],
    queryFn: () => getDetails({ data: { student_id: id } }),
  });

  const removeWorkout = useMutation({
    mutationFn: async (wid: string) => {
      const { error } = await supabase.from("workouts").delete().eq("id", wid);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["student", id] }),
  });

  const [label, setLabel] = useState("A");
  const [name, setName] = useState("");
  const createManual = useMutation({
    mutationFn: async () => {
      const nextIdx = data?.workouts.length ?? 0;
      const { data: w, error } = await supabase
        .from("workouts")
        .insert({
          user_id: id,
          label,
          name,
          order_idx: nextIdx,
          created_by_trainer_id: user.id,
        })
        .select()
        .single();
      if (error) throw error;
      return w;
    },
    onSuccess: (w) => {
      qc.invalidateQueries({ queryKey: ["student", id] });
      setManualOpen(false);
      setName("");
      navigate({ to: "/app/treinos/$id", params: { id: w.id } });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="app-container pt-6">
      <button onClick={() => navigate({ to: "/app/alunos" })} className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Meus alunos
      </button>

      {isLoading && <ListSkeleton rows={3} />}

      {data?.profile && (
        <>
          <header>
            <h1 className="text-3xl font-bold tracking-tight">{data.profile.display_name ?? "Aluno"}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {data.profile.goal ?? "—"} · {data.profile.experience_level ?? "—"} · {data.profile.weekly_frequency ?? "?"}x/sem
            </p>
            {data.profile.injuries && (
              <p className="mt-2 rounded-lg bg-secondary/50 p-3 text-xs">
                <b>Lesões/limitações:</b> {data.profile.injuries}
              </p>
            )}
          </header>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <button
              onClick={() => setManualOpen(true)}
              className="card-soft flex w-full items-center gap-3 p-4 text-left transition-colors hover:bg-secondary/40"
            >
              <div className="grid size-11 place-items-center rounded-xl bg-primary text-primary-foreground">
                <Plus className="size-5" />
              </div>
              <div className="flex-1">
                <p className="font-semibold">Novo treino manual</p>
                <p className="text-xs text-muted-foreground">Você monta exercício por exercício</p>
              </div>
            </button>
            <div className="card-soft flex items-center gap-3 p-4">
              <div className="grid size-11 place-items-center rounded-xl bg-accent text-accent-foreground">
                <span className="text-lg">✨</span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold">Importar treino</p>
                <p className="text-xs text-muted-foreground">Cole o plano ou envie um arquivo</p>
              </div>
              <ImportWorkoutPlanDialog
                userId={id}
                createdByTrainerId={user.id}
                triggerLabel="Importar para o aluno"
                onImported={() => qc.invalidateQueries({ queryKey: ["student", id] })}
              />
            </div>
          </div>


          <h2 className="mt-8 mb-3 font-display text-xl">Treinos do aluno</h2>
          <div className="grid gap-3">
            {data.workouts.length === 0 && (
              <div className="card-soft p-6 text-center text-sm text-muted-foreground">
                Este aluno ainda não tem treinos.
              </div>
            )}
            {data.workouts.map((w) => (
              <div key={w.id} className="card-soft flex items-center gap-3 p-4">
                <span className="grid size-11 place-items-center rounded-xl bg-primary text-lg font-bold text-primary-foreground">
                  {w.label}
                </span>
                <Link to="/app/treinos/$id" params={{ id: w.id }} className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{w.name}</p>
                  {w.created_by_trainer_id === user.id && (
                    <p className="text-xs text-accent">Enviado por você</p>
                  )}
                </Link>
                <button
                  onClick={() => { if (confirm(`Excluir "${w.name}"?`)) removeWorkout.mutate(w.id); }}
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
        </>
      )}

      <Dialog open={manualOpen} onOpenChange={setManualOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Novo treino para {data?.profile?.display_name ?? "aluno"}</DialogTitle></DialogHeader>
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
          <DialogFooter>
            <Button onClick={() => createManual.mutate()} disabled={!name || createManual.isPending}>Criar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}

