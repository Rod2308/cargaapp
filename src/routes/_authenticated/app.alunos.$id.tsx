import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getStudentDetails } from "@/lib/trainer.functions";
import { generatePlan } from "@/lib/coach.functions";
import { supabase } from "@/integrations/supabase/client";
import { Route as AuthedRoute } from "./route";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { ArrowLeft, Sparkles, Loader2, Plus, ChevronRight, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

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
  const [aiOpen, setAiOpen] = useState(false);
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

      {isLoading && <p className="text-sm text-muted-foreground">Carregando...</p>}

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

          <div className="mt-5">
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

      <AiPlanForStudentDialog
        open={aiOpen}
        onOpenChange={setAiOpen}
        studentId={id}
        studentName={data?.profile?.display_name ?? "aluno"}
      />
    </div>
  );
}

function AiPlanForStudentDialog({
  open,
  onOpenChange,
  studentId,
  studentName,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  studentId: string;
  studentName: string;
}) {
  const { user } = AuthedRoute.useRouteContext();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const gen = useServerFn(generatePlan);
  const [goal, setGoal] = useState("Hipertrofia");
  const [days, setDays] = useState(4);
  const [exp, setExp] = useState<"iniciante" | "intermediario" | "avancado">("intermediario");
  const [minutes, setMinutes] = useState(60);
  const [equipment, setEquipment] = useState("");
  const [focus, setFocus] = useState("");
  const [enhancers, setEnhancers] = useState(false);
  const [replace, setReplace] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

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
          for_user_id: studentId,
        },
      }),
    onSuccess: (res) => {
      setAiError(null);
      qc.invalidateQueries({ queryKey: ["student", studentId] });
      if (res.usedFallback) {
        toast.warning("Plano gerado em modo manual (IA indisponível)", {
          description: res.fallbackReason || "Os treinos são um modelo padrão — a IA não conseguiu personalizar agora.",
        });
      } else {
        toast.success(`${res.workouts.length} treinos enviados para ${studentName}!`, { description: res.overview });
      }
      onOpenChange(false);
    },
    onError: (e: any) => setAiError(e?.message ?? "Falha ao gerar plano"),
  });

  const manual = useMutation({
    mutationFn: async () => {
      if (replace) {
        await supabase.from("workouts").delete().eq("user_id", studentId);
      }
      const { data: existing } = await supabase
        .from("workouts")
        .select("order_idx")
        .eq("user_id", studentId)
        .order("order_idx", { ascending: false })
        .limit(1);
      const startIdx = (existing?.[0]?.order_idx ?? -1) + 1;
      const labels = ["A", "B", "C", "D", "E", "F", "G"];
      const rows = Array.from({ length: days }, (_, i) => ({
        user_id: studentId,
        label: labels[i] ?? String(i + 1),
        name: `${goal} — Treino ${labels[i] ?? i + 1}`,
        order_idx: startIdx + i,
        created_by_trainer_id: user.id,
      }));
      const { data, error } = await supabase.from("workouts").insert(rows).select("id");
      if (error) throw error;
      return data ?? [];
    },
    onSuccess: (created) => {
      qc.invalidateQueries({ queryKey: ["student", studentId] });
      toast.success(`${created.length} treinos vazios enviados para ${studentName}.`);
      setAiError(null);
      onOpenChange(false);
      if (created[0]?.id) navigate({ to: "/app/treinos/$id", params: { id: created[0].id } });
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao criar treinos"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="size-5 text-accent" /> Plano para {studentName}
          </DialogTitle>
          <DialogDescription>Os treinos vão direto para o app do aluno.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Objetivo</Label>
            <Select value={goal} onValueChange={setGoal}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Hipertrofia">Hipertrofia</SelectItem>
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
                  {[2, 3, 4, 5, 6].map((d) => <SelectItem key={d} value={String(d)}>{d} dias</SelectItem>)}
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
            <Input value={focus} onChange={(e) => setFocus(e.target.value)} placeholder="Ex: priorizar glúteo" />
          </div>
          <div className="space-y-1.5">
            <Label>Equipamento (opcional)</Label>
            <Textarea rows={2} value={equipment} onChange={(e) => setEquipment(e.target.value)} placeholder="Ex: academia completa" />
          </div>
          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <div>
              <p className="text-sm font-medium">Usa anabolizantes ou SARMs</p>
              <p className="text-xs text-muted-foreground">Substâncias que aceleram ganho de massa. Aumenta volume e frequência.</p>

            </div>
            <Switch checked={enhancers} onCheckedChange={setEnhancers} />
          </div>
          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <div>
              <p className="text-sm font-medium">Substituir treinos atuais do aluno</p>
              <p className="text-xs text-muted-foreground">Apaga os existentes antes de gerar</p>
            </div>
            <Switch checked={replace} onCheckedChange={setReplace} />
          </div>
        </div>

        {aiError && (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm">
            <p className="font-medium text-destructive">A IA falhou</p>
            <p className="mt-1 text-xs text-muted-foreground">{aiError}</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-3 w-full"
              onClick={() => manual.mutate()}
              disabled={manual.isPending}
            >
              {manual.isPending ? (
                <><Loader2 className="size-4 animate-spin" /> Criando...</>
              ) : (
                <>Enviar {days} treinos vazios para {studentName}</>
              )}
            </Button>
          </div>
        )}

        <DialogFooter>
          <Button onClick={() => m.mutate()} disabled={m.isPending} className="w-full">
            {m.isPending ? (<><Loader2 className="size-4 animate-spin" /> Gerando...</>) : (<><Sparkles className="size-4" /> {aiError ? "Tentar de novo" : "Gerar e enviar"}</>)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
