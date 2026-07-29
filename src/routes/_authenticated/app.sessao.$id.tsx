import { PageSkeleton } from "@/components/LoadingState";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { enqueueOp, flush, getPendingCount } from "@/lib/offline-queue";
import {
  clearSessionSnapshot,
  loadFinishDraft,
  loadSessionSnapshot,
  markSessionSnapshotPendingClear,
  type RestSnapshot,
  saveFinishDraft,
  saveSessionSnapshot,
} from "@/lib/session-persist";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ArrowLeft, Check, Flag, Pencil, Trash2, X, Plus, Ban, Timer, Dumbbell, Activity, Heart, Flame, Ruler, FileUp, StickyNote, Sparkles, TrendingUp, TrendingDown, Minus as MinusIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { toastUndo, stripGenerated } from "@/lib/undo";
import { RestTimer } from "@/components/RestTimer";
import { translateActivityType } from "@/lib/workout-file-parser";
import { suggestAdjustment, hasChange, type Suggestion, type SetRow as ProgSetRow } from "@/lib/progression";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export const Route = createFileRoute("/_authenticated/app/sessao/$id")({
  component: SessionPage,
});

function SessionPage() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const restIdRef = useRef(0);

  const [rest, setRest] = useState<{
    id: number;
    seconds: number;
    exerciseName?: string;
    initialTotal?: number;
    initialPaused?: boolean;
  } | null>(null);
  const [restSnapshot, setRestSnapshot] = useState<RestSnapshot>(null);

  const { data: session } = useQuery({
    queryKey: ["session", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("sessions").select("*, workouts(name, label)").eq("id", id).single();
      if (error) throw error;
      return data;
    },
    retry: (count) => (typeof navigator !== "undefined" ? navigator.onLine : true) && count < 2,
  });

  const { data: items = [] } = useQuery({
    queryKey: ["session-plan", id],
    enabled: !!session?.workout_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("workout_exercises")
        .select("*, exercises(*)")
        .eq("workout_id", session!.workout_id!)
        .order("order_idx");
      if (error) throw error;
      return data ?? [];
    },
    retry: (count) => (typeof navigator !== "undefined" ? navigator.onLine : true) && count < 2,
  });

  const { data: sets = [] } = useQuery({
    queryKey: ["session-sets", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("session_sets").select("*").eq("session_id", id).order("completed_at");
      if (error) throw error;
      return data ?? [];
    },
    retry: (count) => (typeof navigator !== "undefined" ? navigator.onLine : true) && count < 2,
  });

  // Hidrata as queries do snapshot local ANTES de tentar a rede, para que o
  // treino em andamento apareça mesmo offline / recém-recarregado.
  const hydratedRef = useRef(false);
  useEffect(() => {
    if (hydratedRef.current) return;
    hydratedRef.current = true;
    void loadSessionSnapshot(id).then((snap) => {
      if (!snap) return;
      if (snap.session && !qc.getQueryData(["session", id])) {
        qc.setQueryData(["session", id], snap.session);
      }
      if (snap.items?.length && !qc.getQueryData(["session-plan", id])) {
        qc.setQueryData(["session-plan", id], snap.items);
      }
      if (snap.sets?.length && !qc.getQueryData(["session-sets", id])) {
        qc.setQueryData(["session-sets", id], snap.sets);
      }
      if (snap.rest && !snap.rest.done && snap.rest.remaining > 0) {
        const elapsed = snap.rest.paused ? 0 : Math.floor((Date.now() - snap.rest.updatedAt) / 1000);
        const remaining = Math.max(0, snap.rest.remaining - elapsed);
        if (remaining > 0) {
          restIdRef.current += 1;
          setRest({
            id: restIdRef.current,
            seconds: remaining,
            exerciseName: snap.rest.exerciseName,
            initialTotal: snap.rest.total,
            initialPaused: snap.rest.paused,
          });
        }
      }
    });
  }, [id, qc]);

  // Salva snapshot sempre que os dados do treino em andamento mudam.
  useEffect(() => {
    if (!session && items.length === 0 && sets.length === 0) return;
    void saveSessionSnapshot(id, { session, items, sets, rest: restSnapshot });
  }, [id, session, items, sets, restSnapshot]);

  // Últimos sets por exercício (excluindo esta sessão) — base para as sugestões
  const exerciseIds = useMemo(
    () => Array.from(new Set((items as any[]).map((it) => it.exercise_id))),
    [items],
  );
  const { data: prevSets = [] } = useQuery({
    queryKey: ["prev-sets", session?.user_id, exerciseIds],
    enabled: !!session?.user_id && exerciseIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from("session_sets")
        .select("weight_kg, reps, rpe, session_id, completed_at, exercise_id, sessions!inner(user_id)")
        .eq("sessions.user_id", session!.user_id)
        .neq("session_id", id)
        .in("exercise_id", exerciseIds)
        .order("completed_at", { ascending: false })
        .limit(200);
      return (data ?? []) as any[];
    },
  });

  const suggestionsByItem = useMemo(() => {
    const map = new Map<string, Suggestion>();
    for (const it of items as any[]) {
      const rows: ProgSetRow[] = (prevSets as any[])
        .filter((r) => r.exercise_id === it.exercise_id)
        .map((r) => ({
          weight_kg: r.weight_kg,
          reps: r.reps,
          rpe: r.rpe,
          session_id: r.session_id,
          completed_at: r.completed_at,
        }));
      map.set(
        it.id,
        suggestAdjustment({
          currentWeight: it.target_weight_kg ?? null,
          currentRest: it.target_rest_seconds ?? 60,
          repRange: it.target_reps,
          rows,
        }),
      );
    }
    return map;
  }, [items, prevSets]);



  const logSet = useMutation({
    mutationFn: async (row: any) => {
      const optimistic = {
        ...row,
        id: crypto.randomUUID(),
        completed_at: new Date().toISOString(),
      };
      qc.setQueryData(["session-sets", id], (prev: any[] = []) => [...prev, optimistic]);
      await enqueueOp({ kind: "insert", table: "session_sets", row: optimistic });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const updateSet = useMutation({
    mutationFn: async ({ setId, reps, weight_kg }: { setId: string; reps: number; weight_kg: number | null }) => {
      qc.setQueryData(["session-sets", id], (prev: any[] = []) =>
        prev.map((s) => (s.id === setId ? { ...s, reps, weight_kg } : s)),
      );
      await enqueueOp({
        kind: "update",
        table: "session_sets",
        match: { id: setId },
        patch: { reps, weight_kg },
      });
      toast.success("Série atualizada");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const updateRest = useMutation({
    mutationFn: async ({ itemId, seconds }: { itemId: string; seconds: number }) => {
      qc.setQueryData(["session-plan", id], (prev: any[] = []) =>
        prev.map((it) => (it.id === itemId ? { ...it, target_rest_seconds: seconds } : it)),
      );
      await enqueueOp({
        kind: "update",
        table: "workout_exercises",
        match: { id: itemId },
        patch: { target_rest_seconds: seconds },
      });
      toast.success(`Descanso ajustado para ${seconds}s`);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const updateTargetWeight = useMutation({
    mutationFn: async ({ itemId, weight }: { itemId: string; weight: number | null }) => {
      qc.setQueryData(["session-plan", id], (prev: any[] = []) =>
        prev.map((it) => (it.id === itemId ? { ...it, target_weight_kg: weight } : it)),
      );
      await enqueueOp({
        kind: "update",
        table: "workout_exercises",
        match: { id: itemId },
        patch: { target_weight_kg: weight },
      });
      toast.success(weight != null ? `Carga alvo ajustada para ${weight}kg` : "Carga alvo removida");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteSet = useMutation({
    mutationFn: async (setId: string) => {
      qc.setQueryData(["session-sets", id], (prev: any[] = []) =>
        prev.filter((s) => s.id !== setId),
      );
      await enqueueOp({ kind: "delete", table: "session_sets", match: { id: setId } });
      toast.success("Série removida");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const removeExerciseItem = useMutation({
    mutationFn: async (item: { id: string; exercise_id: string }) => {
      // Snapshots para permitir "Desfazer" (exercício do plano + séries feitas).
      const itemSnap = ((qc.getQueryData<any[]>(["session-items", id]) ?? []) as any[]).find(
        (it) => it.id === item.id,
      );
      const setsSnap = ((qc.getQueryData<any[]>(["session-sets", id]) ?? []) as any[]).filter(
        (s) => s.workout_exercise_id === item.id,
      );
      qc.setQueryData(["session-sets", id], (prev: any[] = []) =>
        prev.filter((s) => s.workout_exercise_id !== item.id),
      );
      qc.setQueryData(["session-items", id], (prev: any[] = []) =>
        prev.filter((it) => it.id !== item.id),
      );
      await enqueueOp({
        kind: "delete",
        table: "session_sets",
        match: { session_id: id, workout_exercise_id: item.id },
      });
      await enqueueOp({ kind: "delete", table: "workout_exercises", match: { id: item.id } });
      toastUndo({
        message: "Exercício removido",
        description: itemSnap?.exercises?.name ?? undefined,
        onUndo: async () => {
          if (!itemSnap) throw new Error("Não há dados para restaurar");
          await enqueueOp({ kind: "insert", table: "workout_exercises", row: stripGenerated(itemSnap) });
          for (const s of setsSnap) {
            await enqueueOp({ kind: "insert", table: "session_sets", row: stripGenerated(s) });
          }
        },
        onRestored: () => {
          qc.invalidateQueries({ queryKey: ["session-items", id] });
          qc.invalidateQueries({ queryKey: ["session-sets", id] });
        },
      });
    },
    onError: (e: any) => toast.error(e.message),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["session-items", id] });
      qc.invalidateQueries({ queryKey: ["session-sets", id] });
    },
  });



  const finish = useMutation({
    mutationFn: async ({ effort, discomfort }: { effort: number | null; discomfort: string }) => {
      const endedAt = new Date();
      const trimmed = discomfort.trim();
      const patch: Record<string, any> = {
        ended_at: endedAt.toISOString(),
        perceived_effort: effort,
      };
      if (trimmed) {
        const prev = (session?.notes ?? "").trim();
        const marca = `[Desconforto no treino] ${trimmed}`;
        patch.notes = prev ? `${prev}\n\n${marca}` : marca;
      }
      await enqueueOp({
        kind: "update",
        table: "sessions",
        match: { id },
        patch,
      });
      await flush();
      const synced = (await getPendingCount()) === 0;

      // Envia a queixa para o(s) treinador(es) vinculado(s)
      if (trimmed) {
        try {
          const { data: userRes } = await supabase.auth.getUser();
          const uid = userRes.user?.id;
          if (uid) {
            const { data: links } = await supabase
              .from("trainer_students")
              .select("trainer_id")
              .eq("student_id", uid);
            const trainers = (links ?? []).map((l: any) => l.trainer_id).filter(Boolean);
            if (trainers.length > 0) {
              const nomeTreino = session?.workouts?.label
                ? `Treino ${session.workouts.label}${session.workouts.name ? ` — ${session.workouts.name}` : ""}`
                : session?.title || "treino";
              const rpeTxt = effort ? ` (RPE ${effort}/10)` : "";
              const content = `🩺 Desconforto relatado ao finalizar ${nomeTreino}${rpeTxt}:\n\n"${trimmed}"`;
              const rows = trainers.map((tid) => ({
                sender_id: uid,
                receiver_id: tid,
                content,
              }));
              const { error: msgErr } = await supabase.from("messages").insert(rows);
              if (msgErr) console.error("Falha ao notificar treinador:", msgErr);
            }
          }
        } catch (e) {
          console.error("Erro ao enviar queixa ao treinador:", e);
        }
      }

      const startedAt = session?.started_at ? new Date(session.started_at) : endedAt;
      const mins = Math.max(0, Math.round((endedAt.getTime() - startedAt.getTime()) / 60000));
      return { mins, notified: !!trimmed, synced };
    },
    onSuccess: ({ mins, notified, synced }) => {
      if (synced) {
        void clearSessionSnapshot(id);
      } else {
        void markSessionSnapshotPendingClear(id);
      }
      qc.invalidateQueries({ queryKey: ["recent-sessions"] });
      qc.invalidateQueries({ queryKey: ["month-sessions"] });
      qc.invalidateQueries({ queryKey: ["history-sessions"] });
      qc.invalidateQueries({ queryKey: ["recovery"] });
      const h = Math.floor(mins / 60);
      const m = mins % 60;
      const label = h > 0 ? `${h}h${m.toString().padStart(2, "0")}` : `${m} min`;
      toast.success(
        notified
          ? `Treino finalizado — ${label} registrados. Queixa enviada ao treinador.`
          : `Treino finalizado — ${label} registrados`,
      );
      navigate({ to: "/app" });
    },
  });

  const cancelSession = useMutation({
    mutationFn: async () => {
      await enqueueOp({ kind: "delete", table: "sessions", match: { id } });
    },
    onSuccess: () => {
      void clearSessionSnapshot(id);
      qc.invalidateQueries({ queryKey: ["recent-sessions"] });
      qc.invalidateQueries({ queryKey: ["month-sessions"] });
      qc.invalidateQueries({ queryKey: ["history-sessions"] });
      toast.success("Treino cancelado");
      navigate({ to: "/app" });
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Todos exercícios para adicionar extra
  const { data: allExercises = [] } = useQuery({
    queryKey: ["all-exercises"],
    queryFn: async () => {
      const { data } = await supabase.from("exercises").select("id, name, muscle_group, image_url").order("name");
      return data ?? [];
    },
  });

  const [extraOpen, setExtraOpen] = useState(false);
  const [extraExerciseId, setExtraExerciseId] = useState<string>("");
  // Extras adicionados nesta sessão que ainda não têm nenhuma série
  const [pendingExtras, setPendingExtras] = useState<string[]>([]);

  // Agrupar sets extras (sem workout_exercise_id) por exercise_id
  const extraGroups = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const s of sets as any[]) {
      if (!s.workout_exercise_id) {
        const list = map.get(s.exercise_id) ?? [];
        list.push(s);
        map.set(s.exercise_id, list);
      }
    }
    for (const exId of pendingExtras) {
      if (!map.has(exId)) map.set(exId, []);
    }
    return Array.from(map.entries());
  }, [sets, pendingExtras]);

  // Finaliza a série extra em pending assim que já tiver sido salva pelo servidor
  useEffect(() => {
    if (pendingExtras.length === 0) return;
    const withSets = new Set((sets as any[]).filter((s) => !s.workout_exercise_id).map((s) => s.exercise_id));
    const stillPending = pendingExtras.filter((id) => !withSets.has(id));
    if (stillPending.length !== pendingExtras.length) setPendingExtras(stillPending);
  }, [sets, pendingExtras]);



  function startRest(sec: number | null | undefined, exerciseName?: string) {
    const s = Number(sec);
    const seconds = Number.isFinite(s) && s > 0 ? s : 60;
    restIdRef.current += 1;
    setRest({ id: restIdRef.current, seconds, exerciseName });
  }

  const handleRestStateChange = useCallback((state: {
    remaining: number;
    total: number;
    paused: boolean;
    done: boolean;
    exerciseName?: string;
  }) => {
    setRestSnapshot({
      ...state,
      updatedAt: Date.now(),
    });
  }, []);

  if (!session) return <PageSkeleton />;

  return (
    <div className="app-container pt-6">
      <Link to="/app" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Voltar
      </Link>
      <div className="mt-3">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">
          {session.source && session.source !== "manual" ? "Treino importado" : "Sessão em andamento"}
        </p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight">
          {session.workouts
            ? `${session.workouts.label} — ${session.workouts.name}`
            : session.source && session.source !== "manual" && session.activity_type
              ? translateActivityType(session.activity_type)
              : "Treino livre"}
        </h1>
        <ElapsedTimer startedAt={session.started_at} endedAt={session.ended_at} />
      </div>

      {session.source && session.source !== "manual" && (
        <ImportedMetrics session={session} />
      )}

      {/* Ações principais */}
      <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button size="lg" className="h-12 w-full gap-2 shadow-md">
              <Flag className="size-5" /> Finalizar treino
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Finalizar treino?</AlertDialogTitle>
              <AlertDialogDescription>
                O treino será salvo no seu histórico. Você pode registrar o esforço percebido (opcional).
              </AlertDialogDescription>
            </AlertDialogHeader>
            <EffortPicker
              sessionId={id}
              onConfirm={(effort, discomfort) => finish.mutate({ effort, discomfort })}
              pending={finish.isPending}
            />
          </AlertDialogContent>
        </AlertDialog>

        <Dialog open={extraOpen} onOpenChange={setExtraOpen}>
          <DialogTrigger asChild>
            <Button size="lg" variant="outline" className="h-12 w-full gap-2">
              <Plus className="size-5" /> Adicionar exercício
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Adicionar exercício extra</DialogTitle>
            </DialogHeader>
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">
                Registre um exercício que você fez além do treino programado.
              </p>
              <Select value={extraExerciseId} onValueChange={setExtraExerciseId}>
                <SelectTrigger>
                  <SelectValue placeholder="Escolha um exercício" />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  {allExercises.map((e: any) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.name} {e.muscle_group ? `· ${e.muscle_group}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setExtraOpen(false)}>Cancelar</Button>
              <Button
                onClick={() => {
                  if (!extraExerciseId) return toast.error("Escolha um exercício");
                  if (!pendingExtras.includes(extraExerciseId) &&
                      !(sets as any[]).some((s) => !s.workout_exercise_id && s.exercise_id === extraExerciseId)) {
                    setPendingExtras((p) => [...p, extraExerciseId]);
                  }
                  setExtraExerciseId("");
                  setExtraOpen(false);
                }}
              >
                Adicionar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button size="lg" variant="outline" className="h-12 w-full gap-2 border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive">
              <Ban className="size-5" /> Cancelar treino
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Cancelar este treino?</AlertDialogTitle>
              <AlertDialogDescription>
                A sessão e todas as séries registradas serão descartadas. Esta ação não pode ser desfeita.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Voltar</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={() => cancelSession.mutate()}
              >
                Descartar treino
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      {rest !== null && (
        <RestTimer
          key={rest.id}
          seconds={rest.seconds}
          exerciseName={rest.exerciseName}
          initialTotal={rest.initialTotal}
          initialPaused={rest.initialPaused}
          onFinish={() => {
            setRest(null);
            setRestSnapshot(null);
          }}
          onStateChange={handleRestStateChange}
        />
      )}

      {(() => {
        const changes = (items as any[])
          .map((it) => {
            const s = suggestionsByItem.get(it.id);
            if (!s) return null;
            const curW = it.target_weight_kg ?? null;
            const curR = it.target_rest_seconds ?? 60;
            if (!hasChange(s, curW, curR)) return null;
            return { it, s, curW, curR };
          })
          .filter(Boolean) as { it: any; s: Suggestion; curW: number | null; curR: number }[];
        if (changes.length === 0) return null;
        return (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-primary/30 bg-primary/5 p-3">
            <div className="flex items-start gap-2 text-sm">
              <Sparkles className="mt-0.5 size-4 shrink-0 text-primary" />
              <span>
                Há sugestões de ajuste em <strong>{changes.length}</strong>{" "}
                {changes.length === 1 ? "exercício" : "exercícios"} desta sessão.
              </span>
            </div>
            <Button
              size="sm"
              onClick={() => {
                for (const c of changes) {
                  if (c.s.suggested_weight_kg !== c.curW) {
                    updateTargetWeight.mutate({ itemId: c.it.id, weight: c.s.suggested_weight_kg });
                  }
                  if (c.s.suggested_rest_seconds != null && c.s.suggested_rest_seconds !== c.curR) {
                    updateRest.mutate({ itemId: c.it.id, seconds: c.s.suggested_rest_seconds });
                  }
                }
                toast.success(`Sugestões aplicadas em ${changes.length} exercício(s)`);
              }}
            >
              Aplicar em todos
            </Button>
          </div>
        );
      })()}

      <div className="mt-6 grid gap-4 lg:grid-cols-2">

        {items.map((it: any, idx: number) => {
          const done = sets.filter((s: any) => s.workout_exercise_id === it.id);
          const suggestion = suggestionsByItem.get(it.id);
          const suggestedWeight = suggestion?.suggested_weight_kg ?? null;
          return (
            <div key={it.id} className="card-soft p-4">
              <div className="flex items-start gap-3">
                <ExerciseImage url={it.exercises.image_url} alt={it.exercises.name} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <h2 className="font-semibold leading-tight">{idx + 1}. {it.exercises.name}</h2>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="text-xs text-muted-foreground">
                        {done.length}/{it.target_sets}
                      </span>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Remover exercício">
                            <Trash2 className="h-4 w-4 text-muted-foreground" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Remover {it.exercises.name}?</AlertDialogTitle>
                            <AlertDialogDescription>
                              O exercício será removido deste treino{done.length > 0 ? ` junto com ${done.length} série(s) já registrada(s)` : ""}. Essa ação não pode ser desfeita.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={() => removeExerciseItem.mutate({ id: it.id, exercise_id: it.exercise_id })}>
                              Remover
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                    <span>
                      Alvo: {it.target_sets}×{it.target_reps}
                      {it.target_weight_kg && ` · ${it.target_weight_kg} kg`}
                    </span>
                    <span aria-hidden>·</span>
                    <RestEditor
                      seconds={it.target_rest_seconds}
                      onSave={(s) => updateRest.mutate({ itemId: it.id, seconds: s })}
                    />
                  </p>
                </div>
              </div>

              {suggestion && (
                <SuggestionHint
                  suggestion={suggestion}
                  currentWeight={it.target_weight_kg ?? null}
                  currentRest={it.target_rest_seconds ?? 60}
                  onApplyWeight={(w) => updateTargetWeight.mutate({ itemId: it.id, weight: w })}
                  onApplyRest={(s) => updateRest.mutate({ itemId: it.id, seconds: s })}
                />
              )}

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

              <SetLogger
                key={done.length}
                defaultReps={Number(String(it.target_reps).match(/\d+/)?.[0] ?? 10)}
                defaultWeight={
                  done.at(-1)?.weight_kg ??
                  it.target_weight_kg ??
                  suggestedWeight ??
                  ""
                }
                actionLabel={done.length >= it.target_sets ? "Adicionar série extra" : "Adicionar série"}
                onLog={(reps, weight) => {
                  logSet.mutate({
                    session_id: id,
                    workout_exercise_id: it.id,
                    exercise_id: it.exercise_id,
                    set_number: done.length + 1,
                    reps,
                    weight_kg: weight || null,
                  });
                  startRest(it.target_rest_seconds, it.exercises?.name);
                }}
              />
            </div>
          );
        })}


        {extraGroups.map(([exerciseId, doneSets], idx) => {
          const ex = allExercises.find((e: any) => e.id === exerciseId);
          const name = ex?.name ?? "Exercício extra";
          const isSport = ex?.muscle_group === "Esportes";
          return (
            <div key={exerciseId} className="card-soft border border-brand/30 p-4">
              <div className="flex items-start gap-3">
                {!isSport && <ExerciseImage url={ex?.image_url} alt={name} />}
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <h2 className="font-semibold leading-tight">
                      <span className="mr-1 rounded-md bg-brand/20 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-brand">
                        {isSport ? "Esporte" : "Extra"}
                      </span>
                      {items.length + idx + 1}. {name}
                    </h2>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {isSport
                        ? `${doneSets.reduce((a: number, s: any) => a + (s.reps ?? 0), 0)} min`
                        : `${doneSets.length} série${doneSets.length === 1 ? "" : "s"}`}
                    </span>
                  </div>
                  {ex?.muscle_group && !isSport && (
                    <p className="text-xs text-muted-foreground">{ex.muscle_group}</p>
                  )}
                </div>
              </div>
              <div className="mt-3 space-y-2">
                {doneSets.map((s: any, i: number) => (
                  <SetRow
                    key={s.id}
                    index={i}
                    set={s}
                    unit={isSport ? "min" : "reps"}
                    hideWeight={isSport}
                    onSave={(reps, weight_kg) => updateSet.mutate({ setId: s.id, reps, weight_kg: isSport ? null : weight_kg })}
                    onDelete={() => deleteSet.mutate(s.id)}
                  />
                ))}
              </div>
              <SetLogger
                key={doneSets.length}
                defaultReps={Number(doneSets.at(-1)?.reps ?? (isSport ? 30 : 10))}
                defaultWeight={doneSets.at(-1)?.weight_kg ?? ""}
                repsLabel={isSport ? "Minutos" : "Reps"}
                hideWeight={isSport}
                actionLabel={isSport ? "Registrar" : "Adicionar série"}
                onLog={(reps, weight) => {
                  logSet.mutate({
                    session_id: id,
                    workout_exercise_id: null,
                    exercise_id: exerciseId,
                    set_number: doneSets.length + 1,
                    reps,
                    weight_kg: isSport ? null : (weight || null),
                  });
                  if (!isSport) startRest(60, name);
                }}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ExerciseImage({ url, alt }: { url: string | null | undefined; alt: string }) {
  const [frame, setFrame] = useState(0);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!url || failed) return;
    const t = setInterval(() => setFrame((f) => (f === 0 ? 1 : 0)), 900);
    return () => clearInterval(t);
  }, [url, failed]);
  if (!url || failed) {
    return (
      <div className="grid size-20 shrink-0 place-items-center rounded-lg bg-secondary text-muted-foreground">
        <Dumbbell className="size-6" />
      </div>
    );
  }
  const base = frame === 0 ? url : url.replace(/0\.jpg$/, "1.jpg");
  // Cache-buster: mobile browsers/PWA installs may hold a stale 404 from
  // when the bucket was private. Bump this token if bucket state changes again.
  const src = `${base}${base.includes("?") ? "&" : "?"}v=2`;
  return (
    <img
      src={src}
      alt={`Demonstração: ${alt}`}
      loading="lazy"
      decoding="async"
      width={80}
      height={80}
      onError={() => setFailed(true)}
      className="size-20 shrink-0 rounded-lg bg-secondary object-cover"
    />
  );
}

function EffortPicker({ sessionId, onConfirm, pending }: { sessionId: string; onConfirm: (effort: number | null, discomfort: string) => void; pending: boolean }) {
  const [effort, setEffort] = useState<number | null>(null);
  const [discomfort, setDiscomfort] = useState<string>("");
  const draftLoadedRef = useRef(false);
  useEffect(() => {
    if (draftLoadedRef.current) return;
    draftLoadedRef.current = true;
    void loadFinishDraft(sessionId).then((d) => {
      if (!d) return;
      if (typeof d.effort === "number") setEffort(d.effort);
      if (typeof d.discomfort === "string") setDiscomfort(d.discomfort);
    });
  }, [sessionId]);
  useEffect(() => {
    if (!draftLoadedRef.current) return;
    void saveFinishDraft(sessionId, { effort, discomfort });
  }, [sessionId, effort, discomfort]);
  const MAX = 500;
  return (
    <>
      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Esforço percebido (opcional)
        </p>
        <div className="grid grid-cols-10 gap-1">
          {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setEffort(effort === n ? null : n)}
              className={`h-9 rounded-md border text-sm font-semibold transition ${
                effort === n
                  ? "border-brand bg-brand text-brand-foreground"
                  : "border-border bg-background hover:bg-muted"
              }`}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4">
        <label htmlFor="discomfort" className="mb-2 flex items-center justify-between text-xs font-medium uppercase tracking-wider text-muted-foreground">
          <span>Desconforto ou dor durante o treino (opcional)</span>
          <span className="normal-case tracking-normal text-[10px] text-muted-foreground/70">
            {discomfort.length}/{MAX}
          </span>
        </label>
        <textarea
          id="discomfort"
          value={discomfort}
          onChange={(e) => setDiscomfort(e.target.value.slice(0, MAX))}
          rows={3}
          placeholder="Ex: dor leve no ombro direito ao pressionar acima da cabeça, estalo no joelho no agachamento…"
          className="w-full resize-none rounded-md border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-brand/40"
        />
        {discomfort.trim().length > 0 && (
          <p className="mt-1.5 text-[11px] text-muted-foreground">
            Sua queixa será enviada ao seu treinador junto do registro do treino.
          </p>
        )}
      </div>

      <AlertDialogFooter>
        <AlertDialogCancel>Voltar</AlertDialogCancel>
        <AlertDialogAction disabled={pending} onClick={() => onConfirm(effort, discomfort)}>
          <Flag className="size-4" /> Finalizar
        </AlertDialogAction>
      </AlertDialogFooter>
    </>
  );
}


function SetLogger({ defaultReps, defaultWeight, onLog, repsLabel = "Reps", hideWeight = false, actionLabel = "Série" }: { defaultReps: number; defaultWeight: any; onLog: (reps: number, weight: number | null) => void; repsLabel?: string; hideWeight?: boolean; actionLabel?: string }) {
  const [reps, setReps] = useState<string>(String(defaultReps));
  const [weight, setWeight] = useState<string>(String(defaultWeight ?? ""));
  return (
    <div className={`mt-3 grid gap-2 border-t border-border pt-3 ${hideWeight ? "grid-cols-[1fr_auto]" : "grid-cols-[1fr_1fr_auto]"}`}>
      <label className="block">
        <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{repsLabel}</span>
        <Input type="number" inputMode="numeric" value={reps} onChange={(e) => setReps(e.target.value)} className="mt-0.5 h-10" />
      </label>
      {!hideWeight && (
        <label className="block">
          <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Carga (kg)</span>
          <Input type="number" inputMode="decimal" step="0.5" value={weight} onChange={(e) => setWeight(e.target.value)} className="mt-0.5 h-10" />
        </label>
      )}
      <Button
        className="mt-4 h-10"
        onClick={() => {
          const r = Number(reps);
          const w = weight === "" ? null : Number(weight);
          if (r > 0) onLog(r, hideWeight ? null : w);
        }}
      >
        <Plus className="size-4" /> {actionLabel}
      </Button>

    </div>
  );
}

function SetRow({ index, set, onSave, onDelete, unit = "reps", hideWeight = false }: { index: number; set: any; onSave: (reps: number, weight_kg: number | null) => void; onDelete: () => void; unit?: string; hideWeight?: boolean }) {
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
        <span className="text-muted-foreground">{unit === "min" ? "Bloco" : "Série"} {index + 1}:</span>
        <span className="font-semibold">{set.reps} {unit}</span>
        {!hideWeight && set.weight_kg != null && <span className="font-semibold">· {set.weight_kg} kg</span>}
        <div className="ml-auto flex gap-1">
          <Button size="icon" variant="ghost" className="size-7" onClick={() => setEditing(true)} aria-label="Editar">
            <Pencil className="size-3.5" />
          </Button>
          <Button size="icon" variant="ghost" className="size-7 text-destructive hover:text-destructive" onClick={onDelete} aria-label="Excluir">
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 p-2">
      <span className="text-xs text-muted-foreground">{unit === "min" ? "B" : "S"}{index + 1}</span>
      <Input
        type="number"
        inputMode="numeric"
        value={reps}
        onChange={(e) => setReps(e.target.value)}
        className="h-8 w-20"
        placeholder={unit}
      />
      {!hideWeight && (
        <Input
          type="number"
          inputMode="decimal"
          step="0.5"
          value={weight}
          onChange={(e) => setWeight(e.target.value)}
          className="h-8 w-20"
          placeholder="kg"
        />
      )}
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

function ElapsedTimer({ startedAt, endedAt }: { startedAt: string; endedAt?: string | null }) {
  const finished = !!endedAt;
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (finished) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [finished]);
  const start = new Date(startedAt).getTime();
  const end = finished ? new Date(endedAt!).getTime() : now;
  const secs = Math.max(0, Math.floor((end - start) / 1000));
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  const label = h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
  return (
    <div className={`mt-2 inline-flex items-center gap-2 rounded-full border px-3 py-1 ${finished ? "border-muted-foreground/30 bg-muted/40" : "border-brand/30 bg-brand/10"}`}>
      <Timer className={`size-3.5 ${finished ? "text-muted-foreground" : "text-brand"}`} />
      <span className="font-mono text-sm font-semibold tabular-nums text-foreground">{label}</span>
      <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{finished ? "duração total" : "em treino"}</span>
    </div>
  );
}

function ImportedMetrics({ session }: { session: any }) {
  const started = session.started_at ? new Date(session.started_at) : null;
  const ended = session.ended_at ? new Date(session.ended_at) : null;
  const durationSec =
    started && ended ? Math.max(0, Math.round((ended.getTime() - started.getTime()) / 1000)) : null;
  const durationLabel = (() => {
    if (durationSec == null) return null;
    const h = Math.floor(durationSec / 3600);
    const m = Math.floor((durationSec % 3600) / 60);
    const s = durationSec % 60;
    if (h > 0) return `${h}h${String(m).padStart(2, "0")}min`;
    if (m > 0) return `${m}min ${String(s).padStart(2, "0")}s`;
    return `${s}s`;
  })();
  const distanceLabel =
    session.distance_m != null
      ? session.distance_m >= 1000
        ? `${(session.distance_m / 1000).toFixed(2).replace(".", ",")} km`
        : `${session.distance_m} m`
      : null;
  const paceLabel = (() => {
    if (!session.distance_m || !durationSec || session.distance_m < 100) return null;
    const secPerKm = durationSec / (session.distance_m / 1000);
    const m = Math.floor(secPerKm / 60);
    const s = Math.round(secPerKm % 60);
    return `${m}:${String(s).padStart(2, "0")} /km`;
  })();
  const sourceLabel: Record<string, string> = {
    import_fit: "Arquivo .fit",
    import_gpx: "Arquivo .gpx",
    import_tcx: "Arquivo .tcx",
  };

  const stats: { icon: any; label: string; value: string }[] = [];
  if (durationLabel) stats.push({ icon: Timer, label: "Duração", value: durationLabel });
  if (distanceLabel) stats.push({ icon: Ruler, label: "Distância", value: distanceLabel });
  if (paceLabel) stats.push({ icon: Activity, label: "Ritmo médio", value: paceLabel });
  if (session.avg_hr != null) stats.push({ icon: Heart, label: "FC média", value: `${session.avg_hr} bpm` });
  if (session.max_hr != null) stats.push({ icon: Activity, label: "FC máx", value: `${session.max_hr} bpm` });
  if (session.calories != null) stats.push({ icon: Flame, label: "Calorias", value: `${session.calories} kcal` });

  return (
    <div className="card-soft mt-4 p-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-eyebrow text-muted-foreground">Dados do treino importado</p>
          {started && (
            <p className="text-xs text-muted-foreground">
              {format(started, "d 'de' MMMM 'de' yyyy · HH:mm", { locale: ptBR })}
            </p>
          )}
        </div>
        <span className="inline-flex items-center gap-1 rounded-full border border-border bg-secondary/40 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          <FileUp className="size-3" />
          {sourceLabel[session.source as string] ?? session.source}
        </span>
      </div>

      {stats.length > 0 && (
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {stats.map((s) => (
            <div key={s.label} className="flex items-center gap-2 rounded-lg bg-secondary/50 px-2 py-1.5">
              <s.icon className="size-3.5 shrink-0 text-muted-foreground" />
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{s.label}</p>
                <p className="truncate text-sm font-semibold">{s.value}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {session.activity_type && (
        <p className="mt-3 text-xs text-muted-foreground">
          Atividade: <span className="font-medium text-foreground">{translateActivityType(session.activity_type)}</span>
        </p>
      )}

      {session.notes && (
        <div className="mt-3 flex items-start gap-2 rounded-lg border border-border/60 bg-muted/30 p-2">
          <StickyNote className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
          <p className="text-xs text-foreground/90 whitespace-pre-wrap">{session.notes}</p>
        </div>
      )}
    </div>
  );
}

function RestEditor({ seconds, onSave }: { seconds: number; onSave: (s: number) => void }) {
  const [open, setOpen] = useState(false);
  const [val, setVal] = useState<string>(String(seconds));
  useEffect(() => { setVal(String(seconds)); }, [seconds]);
  const PRESETS = [30, 45, 60, 90, 120, 180];
  function commit(next: number) {
    const clamped = Math.max(5, Math.min(600, Math.round(next)));
    if (clamped !== seconds) onSave(clamped);
    setOpen(false);
  }
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1 rounded-full border border-dashed border-border bg-background/60 px-2 py-0.5 text-xs font-medium text-foreground hover:border-brand hover:text-brand"
          aria-label="Editar tempo de descanso"
        >
          <Timer className="size-3" /> descanso {seconds}s
          <Pencil className="size-2.5 opacity-60" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 space-y-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Tempo de descanso
          </p>
          <p className="text-[11px] text-muted-foreground">Entre 5 e 600 segundos.</p>
        </div>
        <div className="flex items-center gap-2">
          <Input
            type="number"
            min={5}
            max={600}
            step={5}
            value={val}
            onChange={(e) => setVal(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") commit(Number(val) || seconds);
            }}
            className="h-9"
            aria-label="Segundos de descanso"
          />
          <span className="text-xs text-muted-foreground">s</span>
          <Button size="sm" onClick={() => commit(Number(val) || seconds)}>
            Salvar
          </Button>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {PRESETS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => commit(p)}
              className={`rounded-full border px-2.5 py-1 text-xs transition ${
                p === seconds
                  ? "border-brand bg-brand/10 text-brand"
                  : "border-border bg-background hover:bg-muted"
              }`}
            >
              {p}s
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function SuggestionHint({
  suggestion,
  currentWeight,
  currentRest,
  onApplyWeight,
  onApplyRest,
}: {
  suggestion: Suggestion;
  currentWeight: number | null;
  currentRest: number;
  onApplyWeight: (w: number | null) => void;
  onApplyRest: (s: number) => void;
}) {
  const change = hasChange(suggestion, currentWeight, currentRest);
  if (suggestion.sessions.length === 0) return null;

  const loadIcon =
    suggestion.loadDirection === "up" ? (
      <TrendingUp className="size-3.5 text-emerald-500" />
    ) : suggestion.loadDirection === "down" ? (
      <TrendingDown className="size-3.5 text-amber-500" />
    ) : (
      <MinusIcon className="size-3.5 text-muted-foreground" />
    );
  const restIcon =
    suggestion.restDirection === "up" ? (
      <TrendingUp className="size-3.5 text-amber-500" />
    ) : suggestion.restDirection === "down" ? (
      <TrendingDown className="size-3.5 text-emerald-500" />
    ) : (
      <MinusIcon className="size-3.5 text-muted-foreground" />
    );

  const applyAll = () => {
    if (change.loadChanged) onApplyWeight(suggestion.suggested_weight_kg ?? null);
    if (change.restChanged && suggestion.suggested_rest_seconds != null) {
      onApplyRest(suggestion.suggested_rest_seconds);
    }
  };

  return (
    <div className="mt-3 rounded-lg border border-brand/30 bg-brand/5 p-3">
      <div className="flex items-start gap-2">
        <Sparkles className="size-4 shrink-0 text-brand" />
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Sugestão do treino anterior
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
            {suggestion.suggested_weight_kg != null && (
              <span className="inline-flex items-center gap-1 rounded-full bg-background px-2 py-0.5 font-medium">
                {loadIcon} Carga {suggestion.suggested_weight_kg}kg
              </span>
            )}
            {suggestion.suggested_rest_seconds != null && (
              <span className="inline-flex items-center gap-1 rounded-full bg-background px-2 py-0.5 font-medium">
                {restIcon} Descanso {suggestion.suggested_rest_seconds}s
              </span>
            )}
          </div>
          <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
            {suggestion.reason}
          </p>
          {change.any && (
            <div className="mt-2 flex flex-wrap gap-2">
              <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={applyAll}>
                <Check className="size-3.5" /> Aplicar sugestão
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

