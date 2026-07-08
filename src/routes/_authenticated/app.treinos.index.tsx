import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { generatePlan } from "@/lib/coach.functions";
import { Route as AuthedRoute } from "./route";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Plus, Trash2, ChevronRight, Sparkles, Loader2 } from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { z } from "zod";

export const Route = createFileRoute("/_authenticated/app/treinos/")({
  validateSearch: z.object({ ai: z.number().optional() }),
  component: TreinosList,
});

function TreinosList() {
  const { user } = AuthedRoute.useRouteContext();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
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
      const { data, error } = await supabase
        .from("workouts")
        .insert({ user_id: user.id, label, name, order_idx: workouts.length })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (w) => {
      qc.invalidateQueries({ queryKey: ["workouts"] });
      setOpen(false);
      setName("");
      navigate({ to: "/app/treinos/$id", params: { id: w.id } });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("workouts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["workouts"] }),
  });

  return (
    <div className="app-container pt-8">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Meus treinos</h1>
          <p className="mt-1 text-sm text-muted-foreground">Suas divisões A, B, C...</p>
        </div>
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
      </header>

      <button
        onClick={() => setAiOpen(true)}
        className="card-soft mt-5 flex w-full items-center gap-3 p-4 text-left transition-colors hover:bg-secondary/40"
      >
        <div className="grid size-11 place-items-center rounded-xl bg-accent text-accent-foreground">
          <Sparkles className="size-5" />
        </div>
        <div className="flex-1">
          <p className="font-semibold leading-tight">Montar treino com IA</p>
          <p className="text-xs text-muted-foreground">Plano personalizado por objetivo, nível e rotina</p>
        </div>
        <ChevronRight className="size-4 text-muted-foreground" />
      </button>

      <AiPlanDialog open={aiOpen} onOpenChange={setAiOpen} />

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {isLoading && <p className="text-sm text-muted-foreground">Carregando...</p>}
        {!isLoading && workouts.length === 0 && (
          <div className="card-soft p-8 text-center">
            <p className="text-sm text-muted-foreground">Nenhum treino ainda.</p>
            <p className="mt-1 text-xs text-muted-foreground">Toque em <b>Montar treino com IA</b> ou crie manualmente em Novo.</p>
          </div>
        )}
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
    </div>
  );
}

function AiPlanDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const qc = useQueryClient();
  const gen = useServerFn(generatePlan);
  const [goal, setGoal] = useState("Hipertrofia");
  const [days, setDays] = useState(4);
  const [exp, setExp] = useState<"iniciante" | "intermediario" | "avancado">("intermediario");
  const [minutes, setMinutes] = useState(60);
  const [equipment, setEquipment] = useState("");
  const [focus, setFocus] = useState("");
  const [enhancers, setEnhancers] = useState(false);
  const [replace, setReplace] = useState(false);

  const m = useMutation({
    mutationFn: () =>
      gen({
        data: {
          goal,
          days_per_week: days,
          experience: exp,
          session_minutes: minutes,
          equipment: equipment || undefined,
          focus: focus || undefined,
          uses_enhancers: enhancers,
          replace_existing: replace,
        },
      }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["workouts"] });
      toast.success(`${res.workouts.length} treinos criados!`, { description: res.overview });
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e.message ?? "Falha ao gerar plano"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="size-5 text-accent" /> Montar treino com IA
          </DialogTitle>
          <DialogDescription>Baseado em ciência do treinamento. A IA escolhe exercícios da sua biblioteca.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Objetivo</Label>
            <Select value={goal} onValueChange={setGoal}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Hipertrofia">Hipertrofia (crescer músculo)</SelectItem>
                <SelectItem value="Força">Força máxima</SelectItem>
                <SelectItem value="Emagrecimento">Emagrecimento / definição</SelectItem>
                <SelectItem value="Resistência muscular">Resistência muscular</SelectItem>
                <SelectItem value="Condicionamento geral">Condicionamento geral</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Dias/semana</Label>
              <Select value={String(days)} onValueChange={(v) => setDays(Number(v))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[2, 3, 4, 5, 6].map((d) => (
                    <SelectItem key={d} value={String(d)}>{d} dias</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Nível</Label>
              <Select value={exp} onValueChange={(v) => setExp(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="iniciante">Iniciante</SelectItem>
                  <SelectItem value="intermediario">Intermediário</SelectItem>
                  <SelectItem value="avancado">Avançado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Duração por sessão (min)</Label>
            <Input type="number" min={20} max={180} value={minutes} onChange={(e) => setMinutes(Number(e.target.value) || 60)} />
          </div>

          <div className="space-y-1.5">
            <Label>Foco extra (opcional)</Label>
            <Input value={focus} onChange={(e) => setFocus(e.target.value)} placeholder="Ex: priorizar glúteo e posterior" />
          </div>

          <div className="space-y-1.5">
            <Label>Equipamento (opcional)</Label>
            <Textarea rows={2} value={equipment} onChange={(e) => setEquipment(e.target.value)} placeholder="Ex: academia completa, ou apenas halteres e banco" />
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <div>
              <p className="text-sm font-medium">Uso ergogênicos</p>
              <p className="text-xs text-muted-foreground">Aumenta volume e frequência</p>
            </div>
            <Switch checked={enhancers} onCheckedChange={setEnhancers} />
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <div>
              <p className="text-sm font-medium">Substituir treinos atuais</p>
              <p className="text-xs text-muted-foreground">Apaga os existentes antes de gerar</p>
            </div>
            <Switch checked={replace} onCheckedChange={setReplace} />
          </div>
        </div>

        <DialogFooter>
          <Button onClick={() => m.mutate()} disabled={m.isPending} className="w-full">
            {m.isPending ? (<><Loader2 className="size-4 animate-spin" /> Gerando plano...</>) : (<><Sparkles className="size-4" /> Gerar plano</>)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
