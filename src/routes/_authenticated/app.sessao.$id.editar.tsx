import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { ArrowLeft, Save, Trash2, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/app/sessao/$id/editar")({
  component: EditSessionPage,
});

type SetRow = {
  id: string;
  exercise_id: string;
  workout_exercise_id: string | null;
  set_number: number;
  reps: number | null;
  weight_kg: number | null;
  exercises?: { name: string; muscle_group?: string | null };
};

function EditSessionPage() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const navigate = useNavigate();

  const { data: session } = useQuery({
    queryKey: ["session", id],
    queryFn: async () => {
      const { data } = await supabase.from("sessions").select("*, workouts(name, label)").eq("id", id).single();
      return data;
    },
  });

  const { data: sets = [] } = useQuery({
    queryKey: ["session-sets-edit", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("session_sets")
        .select("id, exercise_id, workout_exercise_id, set_number, reps, weight_kg, exercises(name, muscle_group)")
        .eq("session_id", id)
        .order("completed_at");
      return (data ?? []) as SetRow[];
    },
  });

  const [notes, setNotes] = useState("");
  const [effort, setEffort] = useState<string>("");
  const [edited, setEdited] = useState<Record<string, { reps: string; weight_kg: string }>>({});

  useEffect(() => {
    if (session) {
      setNotes(session.notes ?? "");
      setEffort(session.perceived_effort ? String(session.perceived_effort) : "");
    }
  }, [session]);

  const saveMeta = useMutation({
    mutationFn: async () => {
      const eff = effort === "" ? null : Number(effort);
      const { error } = await supabase
        .from("sessions")
        .update({ notes: notes || null, perceived_effort: eff && eff >= 1 && eff <= 10 ? eff : null })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Anotações salvas");
      qc.invalidateQueries({ queryKey: ["session", id] });
      qc.invalidateQueries({ queryKey: ["history-sessions"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const saveSet = useMutation({
    mutationFn: async ({ setId, reps, weight }: { setId: string; reps: number | null; weight: number | null }) => {
      const { error } = await supabase.from("session_sets").update({ reps, weight_kg: weight }).eq("id", setId);
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      setEdited((e) => { const { [v.setId]: _, ...rest } = e; return rest; });
      toast.success("Série atualizada");
      qc.invalidateQueries({ queryKey: ["session-sets-edit", id] });
      qc.invalidateQueries({ queryKey: ["session-sets", id] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const delSet = useMutation({
    mutationFn: async (setId: string) => {
      const { error } = await supabase.from("session_sets").delete().eq("id", setId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Série removida");
      qc.invalidateQueries({ queryKey: ["session-sets-edit", id] });
      qc.invalidateQueries({ queryKey: ["session-sets", id] });
      qc.invalidateQueries({ queryKey: ["history-sessions"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const addSet = useMutation({
    mutationFn: async (base: SetRow) => {
      const { error } = await supabase.from("session_sets").insert({
        session_id: id,
        exercise_id: base.exercise_id,
        workout_exercise_id: base.workout_exercise_id,
        set_number: base.set_number + 1,
        reps: base.reps,
        weight_kg: base.weight_kg,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Série adicionada");
      qc.invalidateQueries({ queryKey: ["session-sets-edit", id] });
      qc.invalidateQueries({ queryKey: ["session-sets", id] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const delSession = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("sessions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Treino excluído");
      qc.invalidateQueries({ queryKey: ["history-sessions"] });
      qc.invalidateQueries({ queryKey: ["recent-sessions"] });
      qc.invalidateQueries({ queryKey: ["month-sessions"] });
      navigate({ to: "/app/historico" });
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (!session) return <div className="p-8 text-sm text-muted-foreground">Carregando...</div>;

  // Agrupar séries por exercício
  const groups = new Map<string, SetRow[]>();
  for (const s of sets) {
    const key = s.workout_exercise_id ?? s.exercise_id;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(s);
  }

  return (
    <div className="app-container pt-6">
      <Link to="/app/historico" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Histórico
      </Link>

      <div className="mt-3">
        <p className="text-eyebrow text-muted-foreground">Editar treino</p>
        <h1 className="mt-1 font-display text-2xl tracking-tight">
          {session.workouts ? `${session.workouts.label} — ${session.workouts.name}` : "Treino livre"}
        </h1>
        <p className="mt-1 text-xs text-muted-foreground">
          {format(new Date(session.started_at), "d 'de' MMMM 'de' yyyy · HH:mm", { locale: ptBR })}
        </p>
      </div>

      {/* Meta */}
      <div className="card-lift mt-6 space-y-3 p-4">
        <label className="block">
          <span className="text-eyebrow text-muted-foreground">Esforço percebido (1-10)</span>
          <Input
            type="number"
            inputMode="numeric"
            min={1}
            max={10}
            value={effort}
            onChange={(e) => setEffort(e.target.value)}
            className="mt-1 h-10 max-w-24"
          />
        </label>
        <label className="block">
          <span className="text-eyebrow text-muted-foreground">Anotações</span>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Como foi o treino? Sensações, dores, progresso..."
            className="mt-1 min-h-24"
          />
        </label>
        <Button onClick={() => saveMeta.mutate()} disabled={saveMeta.isPending} size="sm">
          <Save className="size-4" /> Salvar anotações
        </Button>
      </div>

      {/* Séries por exercício */}
      <div className="mt-6 space-y-4">
        {groups.size === 0 && (
          <p className="text-sm text-muted-foreground">Nenhuma série registrada nesta sessão.</p>
        )}
        {Array.from(groups.entries()).map(([key, list]) => {
          const name = list[0].exercises?.name ?? "Exercício";
          const isSport = list[0].exercises?.muscle_group === "Esportes";
          const repsLabel = isSport ? "Minutos" : "Reps";
          return (
            <div key={key} className="card-soft p-4">
              <h2 className="font-display text-base font-bold">
                {name}
                {isSport && <span className="ml-2 rounded-md bg-brand/20 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-brand-foreground">Esporte</span>}
              </h2>
              <div className="mt-3 space-y-2">
                {list.map((s, i) => {
                  const draft = edited[s.id] ?? {
                    reps: s.reps != null ? String(s.reps) : "",
                    weight_kg: s.weight_kg != null ? String(s.weight_kg) : "",
                  };
                  const dirty = !!edited[s.id];
                  return (
                    <div key={s.id} className={`grid items-end gap-2 ${isSport ? "grid-cols-[auto_1fr_auto_auto]" : "grid-cols-[auto_1fr_1fr_auto_auto]"}`}>
                      <span className="pb-2 text-xs text-muted-foreground tabular-nums">#{i + 1}</span>
                      <label className="block">
                        <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{repsLabel}</span>
                        <Input
                          type="number"
                          inputMode="numeric"
                          value={draft.reps}
                          onChange={(e) =>
                            setEdited((prev) => ({ ...prev, [s.id]: { ...draft, reps: e.target.value } }))
                          }
                          className="mt-0.5 h-9"
                        />
                      </label>
                      {!isSport && (
                        <label className="block">
                          <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Kg</span>
                          <Input
                            type="number"
                            inputMode="decimal"
                            step="0.5"
                            value={draft.weight_kg}
                            onChange={(e) =>
                              setEdited((prev) => ({ ...prev, [s.id]: { ...draft, weight_kg: e.target.value } }))
                            }
                            className="mt-0.5 h-9"
                          />
                        </label>
                      )}
                      <Button
                        size="sm"
                        variant={dirty ? "default" : "outline"}
                        disabled={!dirty || saveSet.isPending}
                        onClick={() => {
                          const reps = draft.reps === "" ? null : Number(draft.reps);
                          const weight = draft.weight_kg === "" ? null : Number(draft.weight_kg);
                          saveSet.mutate({ setId: s.id, reps, weight });
                        }}
                      >
                        <Save className="size-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-destructive hover:text-destructive"
                        onClick={() => delSet.mutate(s.id)}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  );
                })}
              </div>
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={() => addSet.mutate(list[list.length - 1])}
                disabled={addSet.isPending}
              >
                <Plus className="size-3.5" /> Adicionar série
              </Button>
            </div>
          );
        })}
      </div>

      {/* Danger zone */}
      <div className="mt-8 border-t border-border pt-6">
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline" className="text-destructive hover:text-destructive">
              <Trash2 className="size-4" /> Excluir este treino
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir este treino?</AlertDialogTitle>
              <AlertDialogDescription>
                A sessão e todas as séries registradas serão removidas permanentemente.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={() => delSession.mutate()}>Excluir</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
