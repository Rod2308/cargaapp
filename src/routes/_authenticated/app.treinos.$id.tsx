import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Route as AuthedRoute } from "./route";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { ArrowLeft, Play, Plus, Trash2, GripVertical, TrendingUp, TrendingDown, Minus, Sparkles, Check } from "lucide-react";
import { useState, useMemo, useEffect } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { suggestAdjustment, hasChange, type Suggestion } from "@/lib/progression";


export const Route = createFileRoute("/_authenticated/app/treinos/$id")({
  validateSearch: z.object({ add: z.number().optional() }),
  component: WorkoutEditor,
});

function WorkoutEditor() {
  const { id } = Route.useParams();
  const routeSearch = Route.useSearch();
  const { user } = AuthedRoute.useRouteContext();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [addOpen, setAddOpen] = useState(false);
  const [muscleFilter, setMuscleFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  useEffect(() => {
    if (routeSearch.add) {
      setAddOpen(true);
      navigate({ to: "/app/treinos/$id", params: { id }, search: {}, replace: true });
    }
  }, [routeSearch.add, id, navigate]);



  const { data: workout } = useQuery({
    queryKey: ["workout", id],
    queryFn: async () => {
      const { data } = await supabase.from("workouts").select("*").eq("id", id).single();
      return data;
    },
  });

  const { data: items = [] } = useQuery({
    queryKey: ["workout-exercises", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("workout_exercises")
        .select("*, exercises(*)")
        .eq("workout_id", id)
        .order("order_idx");
      return data ?? [];
    },
  });

  const { data: exercises = [] } = useQuery({
    queryKey: ["exercises"],
    queryFn: async () => {
      const { data } = await supabase.from("exercises").select("*").order("muscle_group").order("name");
      return data ?? [];
    },
  });

  const muscleGroups = useMemo(() => {
    return Array.from(new Set(exercises.map((e) => e.muscle_group))).sort();
  }, [exercises]);

  const filtered = exercises.filter(
    (e) =>
      (muscleFilter === "all" || e.muscle_group === muscleFilter) &&
      (!search || e.name.toLowerCase().includes(search.toLowerCase())),
  );

  const updateWorkout = useMutation({
    mutationFn: async (patch: any) => {
      const { error } = await supabase.from("workouts").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["workout", id] }),
  });

  const addExercise = useMutation({
    mutationFn: async ({ exerciseId, orderIdx }: { exerciseId: string; orderIdx: number }) => {
      const { error } = await supabase.from("workout_exercises").insert({
        workout_id: id,
        exercise_id: exerciseId,
        order_idx: orderIdx,
        target_sets: 3,
        target_reps: "10",
        target_rest_seconds: 90,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["workout-exercises", id] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const addedIds = useMemo(() => new Set((items as any[]).map((it) => it.exercise_id)), [items]);

  const updateItem = useMutation({
    mutationFn: async ({ itemId, patch }: { itemId: string; patch: any }) => {
      const { error } = await supabase.from("workout_exercises").update(patch).eq("id", itemId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["workout-exercises", id] }),
  });

  const itemIds = useMemo(() => items.map((it: any) => it.id), [items]);
  const { data: recentSets = [] } = useQuery({
    enabled: itemIds.length > 0,
    queryKey: ["workout-recent-sets", id, itemIds],
    queryFn: async () => {
      const { data } = await supabase
        .from("session_sets")
        .select("weight_kg, reps, rpe, session_id, completed_at, workout_exercise_id")
        .in("workout_exercise_id", itemIds)
        .order("completed_at", { ascending: false })
        .limit(300);
      return data ?? [];
    },
  });

  const suggestionsByItem = useMemo(() => {
    const map = new Map<string, Suggestion>();
    for (const it of items as any[]) {
      const rows = (recentSets as any[]).filter((r) => r.workout_exercise_id === it.id);
      map.set(
        it.id,
        suggestAdjustment({
          currentWeight: it.target_weight_kg ?? null,
          currentRest: it.target_rest_seconds,
          repRange: it.target_reps,
          rows,
        }),
      );
    }
    return map;
  }, [items, recentSets]);

  const pendingSuggestions = useMemo(() => {
    const out: { itemId: string; patch: any }[] = [];
    for (const it of items as any[]) {
      const s = suggestionsByItem.get(it.id);
      if (!s) continue;
      const change = hasChange(s, it.target_weight_kg ?? null, it.target_rest_seconds);
      if (!change.any) continue;
      const patch: any = {};
      if (change.loadChanged) patch.target_weight_kg = s.suggested_weight_kg;
      if (change.restChanged) patch.target_rest_seconds = s.suggested_rest_seconds;
      out.push({ itemId: it.id, patch });
    }
    return out;
  }, [items, suggestionsByItem]);

  const applyAll = useMutation({
    mutationFn: async () => {
      for (const { itemId, patch } of pendingSuggestions) {
        const { error } = await supabase.from("workout_exercises").update(patch).eq("id", itemId);
        if (error) throw error;
      }
      return pendingSuggestions.length;
    },
    onSuccess: (n) => {
      qc.invalidateQueries({ queryKey: ["workout-exercises", id] });
      toast.success(`${n} ajuste${n === 1 ? "" : "s"} aplicado${n === 1 ? "" : "s"}.`);
    },
    onError: (e: any) => toast.error(e.message ?? "Falha ao aplicar sugestões"),
  });


  const removeItem = useMutation({
    mutationFn: async (itemId: string) => {
      const { error } = await supabase.from("workout_exercises").delete().eq("id", itemId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["workout-exercises", id] }),
  });

  const startSession = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase
        .from("sessions")
        .insert({ user_id: user.id, workout_id: id })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (s) => navigate({ to: "/app/sessao/$id", params: { id: s.id } }),
  });

  if (!workout) return <div className="p-8 text-sm text-muted-foreground">Carregando...</div>;

  return (
    <TooltipProvider delayDuration={200}>
    <div className="app-container pt-6">

      <Link to="/app/treinos" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Voltar
      </Link>

      <div className="mt-4 flex items-start gap-3">
        <span className="inline-flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary text-lg font-bold text-primary-foreground">
          {workout.label}
        </span>
        <div className="min-w-0 flex-1">
          <Input
            className="border-0 bg-transparent p-0 text-2xl font-bold tracking-tight shadow-none focus-visible:ring-0"
            defaultValue={workout.name}
            onBlur={(e) => e.target.value !== workout.name && updateWorkout.mutate({ name: e.target.value })}
          />
          <Textarea
            className="mt-1 min-h-8 resize-none border-0 bg-transparent p-0 text-sm text-muted-foreground shadow-none focus-visible:ring-0"
            defaultValue={workout.notes ?? ""}
            placeholder="Adicione uma nota (ex: peito e tríceps, 2ª feira)"
            onBlur={(e) => e.target.value !== (workout.notes ?? "") && updateWorkout.mutate({ notes: e.target.value })}
          />
        </div>
      </div>

      <div className="mt-4 flex gap-2">
        <Button className="flex-1" onClick={() => startSession.mutate()} disabled={items.length === 0 || startSession.isPending}>
          <Play className="size-4" /> Iniciar treino
        </Button>
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild>
            <Button variant="outline"><Plus className="size-4" /> Exercício</Button>
          </DialogTrigger>
          <DialogContent className="max-h-[80vh] overflow-hidden">
            <DialogHeader><DialogTitle>Adicionar exercício</DialogTitle></DialogHeader>
            <div className="flex gap-2">
              <Input placeholder="Buscar..." value={search} onChange={(e) => setSearch(e.target.value)} />
              <Select value={muscleFilter} onValueChange={setMuscleFilter}>
                <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os grupos</SelectItem>
                  {muscleGroups.map((g) => (
                    <SelectItem key={g} value={g}>{g}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="max-h-[50vh] space-y-1 overflow-y-auto">
              {filtered.map((e) => {
                const added = addedIds.has(e.id);
                return (
                  <button
                    key={e.id}
                    onClick={() => {
                      if (added) return;
                      addExercise.mutate({ exerciseId: e.id, orderIdx: items.length + addExercise.submittedAt ? 0 : 0 });
                    }}
                    disabled={added || addExercise.isPending}
                    className="flex w-full items-center justify-between rounded-lg p-3 text-left transition-colors hover:bg-secondary disabled:cursor-default"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{e.name}</p>
                      <p className="text-xs text-muted-foreground">{e.muscle_group}{e.equipment && ` · ${e.equipment}`}</p>
                    </div>
                    {added ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-300">
                        <Check className="size-3" /> Adicionado
                      </span>
                    ) : (
                      <Plus className="size-4 text-muted-foreground" />
                    )}
                  </button>
                );
              })}
              {filtered.length === 0 && <p className="p-4 text-center text-sm text-muted-foreground">Nenhum exercício encontrado.</p>}
            </div>
            <DialogFooter>
              <Button onClick={() => setAddOpen(false)} className="w-full sm:w-auto">Concluir</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {pendingSuggestions.length > 0 && (
        <div className="mt-3 flex items-center gap-3 rounded-xl border border-accent/40 bg-accent/10 p-3">
          <Sparkles className="size-4 shrink-0 text-accent" />
          <p className="min-w-0 flex-1 text-xs">
            <span className="font-medium text-foreground">{pendingSuggestions.length} ajuste{pendingSuggestions.length === 1 ? "" : "s"} sugerido{pendingSuggestions.length === 1 ? "" : "s"}</span>
            <span className="text-muted-foreground"> com base nas últimas sessões.</span>
          </p>
          <Button size="sm" variant="secondary" onClick={() => applyAll.mutate()} disabled={applyAll.isPending}>
            Aplicar tudo
          </Button>
        </div>
      )}


      <div className="mt-6 grid gap-3 lg:grid-cols-2">
        {items.length === 0 && (
          <div className="card-soft p-6 text-center text-sm text-muted-foreground">
            Adicione exercícios para começar.
          </div>
        )}
        {items.map((it: any, idx: number) => (
          <div key={it.id} className="card-soft p-4">
            <div className="flex items-start gap-2">
              <GripVertical className="mt-1 size-4 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="font-semibold leading-tight">{idx + 1}. {it.exercises.name}</p>
                <p className="text-xs text-muted-foreground">{it.exercises.muscle_group}{it.exercises.equipment && ` · ${it.exercises.equipment}`}</p>
              </div>
              <button
                onClick={() => removeItem.mutate(it.id)}
                className="grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-destructive"
              >
                <Trash2 className="size-4" />
              </button>
            </div>
            <div className="mt-3 grid grid-cols-4 gap-2">
              <FieldNum label="Séries" value={it.target_sets} onSave={(v) => updateItem.mutate({ itemId: it.id, patch: { target_sets: v } })} />
              <FieldText label="Reps" value={it.target_reps} onSave={(v) => updateItem.mutate({ itemId: it.id, patch: { target_reps: v } })} />
              <FieldNum label="Carga (kg)" step={0.5} value={it.target_weight_kg ?? ""} onSave={(v) => updateItem.mutate({ itemId: it.id, patch: { target_weight_kg: v || null } })} />
              <FieldNum label="Desc. (s)" value={it.target_rest_seconds} onSave={(v) => updateItem.mutate({ itemId: it.id, patch: { target_rest_seconds: v } })} />
            </div>
            <SuggestionRow
              suggestion={suggestionsByItem.get(it.id)}
              currentWeight={it.target_weight_kg ?? null}
              currentRest={it.target_rest_seconds}
              onApply={(patch) => updateItem.mutate({ itemId: it.id, patch })}
            />
          </div>
        ))}
      </div>
    </div>
    </TooltipProvider>
  );
}


function FieldNum({ label, value, onSave, step }: { label: string; value: any; step?: number; onSave: (v: number) => void }) {
  return (
    <label className="block">
      <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
      <Input
        type="number"
        step={step ?? 1}
        defaultValue={value ?? ""}
        onBlur={(e) => {
          const n = Number(e.target.value);
          if (!Number.isNaN(n) && String(n) !== String(value)) onSave(n);
        }}
        className="mt-0.5 h-9 px-2 text-sm"
      />
    </label>
  );
}
function FieldText({ label, value, onSave }: { label: string; value: string; onSave: (v: string) => void }) {
  return (
    <label className="block">
      <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
      <Input
        defaultValue={value}
        onBlur={(e) => e.target.value !== value && onSave(e.target.value)}
        className="mt-0.5 h-9 px-2 text-sm"
      />
    </label>
  );
}

function SuggestionRow({
  suggestion,
  currentWeight,
  currentRest,
  onApply,
}: {
  suggestion: Suggestion | undefined;
  currentWeight: number | null;
  currentRest: number;
  onApply: (patch: { target_weight_kg?: number | null; target_rest_seconds?: number }) => void;
}) {
  if (!suggestion) return null;
  const change = hasChange(suggestion, currentWeight, currentRest);
  const noData = suggestion.sessions.length < 2;

  if (noData) {
    return (
      <p className="mt-2 text-[11px] text-muted-foreground">Sem dados suficientes ainda — registre pelo menos 2 sessões.</p>
    );
  }

  if (!change.any) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <p className="mt-2 inline-flex cursor-help items-center gap-1 text-[11px] text-muted-foreground">
            <Minus className="size-3" /> Progresso ok — manter carga e descanso
          </p>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs text-xs">{suggestion.reason}</TooltipContent>
      </Tooltip>
    );
  }

  const patch: { target_weight_kg?: number | null; target_rest_seconds?: number } = {};
  if (change.loadChanged) patch.target_weight_kg = suggestion.suggested_weight_kg;
  if (change.restChanged && suggestion.suggested_rest_seconds != null) patch.target_rest_seconds = suggestion.suggested_rest_seconds;

  const loadIcon =
    suggestion.loadDirection === "up" ? <TrendingUp className="size-3" /> :
    suggestion.loadDirection === "down" ? <TrendingDown className="size-3" /> : null;
  const restIcon =
    suggestion.restDirection === "up" ? <TrendingUp className="size-3" /> :
    suggestion.restDirection === "down" ? <TrendingDown className="size-3" /> : null;

  const tone =
    suggestion.loadDirection === "up"
      ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
      : suggestion.loadDirection === "down"
      ? "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300"
      : "border-border bg-secondary/40 text-foreground";

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={() => onApply(patch)}
          className={`mt-2 flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left text-xs hover:brightness-110 ${tone}`}
        >
          <Sparkles className="size-3 shrink-0" />
          <span className="min-w-0 flex-1">
            Sugestão:
            {change.loadChanged && (
              <span className="ml-1 inline-flex items-center gap-1 font-medium">
                {loadIcon} {suggestion.suggested_weight_kg}kg
              </span>
            )}
            {change.loadChanged && change.restChanged && <span className="mx-1 opacity-60">·</span>}
            {change.restChanged && (
              <span className="inline-flex items-center gap-1 font-medium">
                {restIcon} descanso {suggestion.suggested_rest_seconds}s
              </span>
            )}
          </span>
          <span className="shrink-0 text-[10px] opacity-70">tocar p/ aplicar</span>
        </button>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs text-xs">{suggestion.reason}</TooltipContent>
    </Tooltip>
  );
}

