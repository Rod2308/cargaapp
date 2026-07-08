import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Check, Play, Pause, RotateCcw, Flag, Pencil, Trash2, X, Plus, Ban } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/app/sessao/$id")({
  component: SessionPage,
});

function SessionPage() {
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

  const { data: items = [] } = useQuery({
    queryKey: ["session-plan", id],
    enabled: !!session?.workout_id,
    queryFn: async () => {
      const { data } = await supabase
        .from("workout_exercises")
        .select("*, exercises(*)")
        .eq("workout_id", session!.workout_id!)
        .order("order_idx");
      return data ?? [];
    },
  });

  const { data: sets = [] } = useQuery({
    queryKey: ["session-sets", id],
    queryFn: async () => {
      const { data } = await supabase.from("session_sets").select("*").eq("session_id", id).order("completed_at");
      return data ?? [];
    },
  });

  const logSet = useMutation({
    mutationFn: async (row: any) => {
      const { error } = await supabase.from("session_sets").insert(row);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["session-sets", id] }),
    onError: (e: any) => toast.error(e.message),
  });

  const updateSet = useMutation({
    mutationFn: async ({ setId, reps, weight_kg }: { setId: string; reps: number; weight_kg: number | null }) => {
      const { error } = await supabase.from("session_sets").update({ reps, weight_kg }).eq("id", setId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["session-sets", id] });
      toast.success("Série atualizada");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteSet = useMutation({
    mutationFn: async (setId: string) => {
      const { error } = await supabase.from("session_sets").delete().eq("id", setId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["session-sets", id] });
      toast.success("Série removida");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const finish = useMutation({
    mutationFn: async (effort: number | null) => {
      const { error } = await supabase.from("sessions").update({ ended_at: new Date().toISOString(), perceived_effort: effort }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["recent-sessions"] });
      qc.invalidateQueries({ queryKey: ["month-sessions"] });
      qc.invalidateQueries({ queryKey: ["history-sessions"] });
      qc.invalidateQueries({ queryKey: ["recovery"] });
      toast.success("Treino finalizado!");
      navigate({ to: "/app" });
    },
  });

  const [restSeconds, setRestSeconds] = useState<number | null>(null);
  const [remaining, setRemaining] = useState(0);
  const [paused, setPaused] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (restSeconds === null || paused) return;
    intervalRef.current = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          if (intervalRef.current) clearInterval(intervalRef.current);
          try {
            const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
            if (AC) {
              const ctx = new AC();
              const o = ctx.createOscillator();
              const g = ctx.createGain();
              o.connect(g); g.connect(ctx.destination);
              o.frequency.value = 880; g.gain.value = 0.2;
              o.start(); setTimeout(() => { o.stop(); ctx.close(); }, 350);
            }
          } catch {}
          setRestSeconds(null);
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [restSeconds, paused]);

  function startRest(sec: number) {
    setRestSeconds(sec);
    setRemaining(sec);
    setPaused(false);
  }

  if (!session) return <div className="p-8 text-sm text-muted-foreground">Carregando...</div>;

  return (
    <div className="app-container pt-6">
      <Link to="/app" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Voltar
      </Link>
      <div className="mt-3 flex items-start justify-between">
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Sessão em andamento</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">
            {session.workouts ? `${session.workouts.label} — ${session.workouts.name}` : "Treino livre"}
          </h1>
        </div>
        <Button variant="outline" size="sm" onClick={() => {
          const e = prompt("Como foi o esforço? (1 a 10)");
          const n = e ? Number(e) : null;
          finish.mutate(n && n >= 1 && n <= 10 ? n : null);
        }}>
          <Flag className="size-4" /> Finalizar
        </Button>
      </div>

      {restSeconds !== null && (
        <div className="card-soft sticky top-3 z-20 mt-4 flex items-center gap-4 p-4">
          <div className="grid size-14 place-items-center rounded-full bg-accent text-2xl font-bold text-accent-foreground tabular-nums">
            {remaining}
          </div>
          <div className="flex-1">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Descanso</p>
            <p className="text-sm font-semibold">{paused ? "Pausado" : "Contando..."}</p>
          </div>
          <Button size="sm" variant="outline" onClick={() => setPaused((p) => !p)}>
            {paused ? <Play className="size-4" /> : <Pause className="size-4" />}
          </Button>
          <Button size="sm" variant="outline" onClick={() => { setRestSeconds(null); setRemaining(0); }}>
            <RotateCcw className="size-4" />
          </Button>
        </div>
      )}

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        {items.map((it: any, idx: number) => {
          const done = sets.filter((s: any) => s.workout_exercise_id === it.id);
          return (
            <div key={it.id} className="card-soft p-4">
              <div className="flex items-baseline justify-between">
                <h2 className="font-semibold leading-tight">{idx + 1}. {it.exercises.name}</h2>
                <span className="text-xs text-muted-foreground">
                  {done.length}/{it.target_sets}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Alvo: {it.target_sets}×{it.target_reps}
                {it.target_weight_kg && ` · ${it.target_weight_kg} kg`} · descanso {it.target_rest_seconds}s
              </p>

              <div className="mt-3 space-y-2">
                {done.map((s: any, i: number) => (
                  <SetRow
                    key={s.id}
                    index={i}
                    set={s}
                    onSave={(reps, weight_kg) => updateSet.mutate({ setId: s.id, reps, weight_kg })}
                    onDelete={() => deleteSet.mutate(s.id)}
                  />
                ))}
              </div>

              {done.length < it.target_sets && (
                <SetLogger
                  key={done.length}
                  defaultReps={Number(String(it.target_reps).match(/\d+/)?.[0] ?? 10)}
                  defaultWeight={done.at(-1)?.weight_kg ?? it.target_weight_kg ?? ""}
                  onLog={(reps, weight) => {
                    logSet.mutate({
                      session_id: id,
                      workout_exercise_id: it.id,
                      exercise_id: it.exercise_id,
                      set_number: done.length + 1,
                      reps,
                      weight_kg: weight || null,
                    });
                    startRest(it.target_rest_seconds);
                  }}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SetLogger({ defaultReps, defaultWeight, onLog }: { defaultReps: number; defaultWeight: any; onLog: (reps: number, weight: number | null) => void }) {
  const [reps, setReps] = useState<string>(String(defaultReps));
  const [weight, setWeight] = useState<string>(String(defaultWeight ?? ""));
  return (
    <div className="mt-3 grid grid-cols-[1fr_1fr_auto] gap-2 border-t border-border pt-3">
      <label className="block">
        <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Reps</span>
        <Input type="number" inputMode="numeric" value={reps} onChange={(e) => setReps(e.target.value)} className="mt-0.5 h-10" />
      </label>
      <label className="block">
        <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Carga (kg)</span>
        <Input type="number" inputMode="decimal" step="0.5" value={weight} onChange={(e) => setWeight(e.target.value)} className="mt-0.5 h-10" />
      </label>
      <Button
        className="mt-4 h-10"
        onClick={() => {
          const r = Number(reps);
          const w = weight === "" ? null : Number(weight);
          if (r > 0) onLog(r, w);
        }}
      >
        <Check className="size-4" /> Série
      </Button>
    </div>
  );
}

function SetRow({ index, set, onSave, onDelete }: { index: number; set: any; onSave: (reps: number, weight_kg: number | null) => void; onDelete: () => void }) {
  const [editing, setEditing] = useState(false);
  const [reps, setReps] = useState<string>(String(set.reps ?? ""));
  const [weight, setWeight] = useState<string>(set.weight_kg != null ? String(set.weight_kg) : "");

  useEffect(() => {
    setReps(String(set.reps ?? ""));
    setWeight(set.weight_kg != null ? String(set.weight_kg) : "");
  }, [set.reps, set.weight_kg]);

  if (!editing) {
    return (
      <div className="flex items-center gap-2 text-sm">
        <Check className="size-4 shrink-0 text-success" />
        <span className="text-muted-foreground">Série {index + 1}:</span>
        <span className="font-semibold">{set.reps} reps</span>
        {set.weight_kg != null && <span className="font-semibold">· {set.weight_kg} kg</span>}
        <div className="ml-auto flex gap-1">
          <Button size="icon" variant="ghost" className="size-7" onClick={() => setEditing(true)} aria-label="Editar série">
            <Pencil className="size-3.5" />
          </Button>
          <Button size="icon" variant="ghost" className="size-7 text-destructive hover:text-destructive" onClick={onDelete} aria-label="Excluir série">
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 p-2">
      <span className="text-xs text-muted-foreground">S{index + 1}</span>
      <Input
        type="number"
        inputMode="numeric"
        value={reps}
        onChange={(e) => setReps(e.target.value)}
        className="h-8 w-16"
        placeholder="reps"
      />
      <Input
        type="number"
        inputMode="decimal"
        step="0.5"
        value={weight}
        onChange={(e) => setWeight(e.target.value)}
        className="h-8 w-20"
        placeholder="kg"
      />
      <div className="ml-auto flex gap-1">
        <Button
          size="icon"
          className="size-7"
          onClick={() => {
            const r = Number(reps);
            if (!(r > 0)) return;
            const w = weight === "" ? null : Number(weight);
            onSave(r, w);
            setEditing(false);
          }}
          aria-label="Salvar"
        >
          <Check className="size-3.5" />
        </Button>
        <Button size="icon" variant="ghost" className="size-7" onClick={() => setEditing(false)} aria-label="Cancelar">
          <X className="size-3.5" />
        </Button>
      </div>
    </div>
  );
}
