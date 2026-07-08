import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Route as AuthedRoute } from "./route";
import { Button } from "@/components/ui/button";
import { Sparkles, Play, Plus, ArrowUpRight, Flame, Calendar as CalendarIcon, Dumbbell, Quote, Trophy, HeartPulse, RefreshCw } from "lucide-react";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar } from "@/components/ui/calendar";
import { useMemo, useState } from "react";
import { getDailyQuote } from "@/lib/quotes";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { getRecoveryAdvice } from "@/lib/recovery.functions";

export const Route = createFileRoute("/_authenticated/app/")({
  component: Dashboard,
});

function Dashboard() {
  const { user } = AuthedRoute.useRouteContext();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: profile } = useQuery({
    queryKey: ["profile", user.id],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
      return data;
    },
  });

  const { data: workouts = [] } = useQuery({
    queryKey: ["workouts", user.id],
    queryFn: async () => {
      const { data } = await supabase.from("workouts").select("*").eq("user_id", user.id).order("order_idx");
      return data ?? [];
    },
  });

  const { data: recent = [] } = useQuery({
    queryKey: ["recent-sessions", user.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("sessions")
        .select("id, started_at, ended_at, workout_id, workouts(name, label)")
        .eq("user_id", user.id)
        .order("started_at", { ascending: false })
        .limit(5);
      return data ?? [];
    },
  });

  const [month, setMonth] = useState(new Date());
  const { data: monthSessions = [] } = useQuery({
    queryKey: ["month-sessions", user.id, month.getFullYear(), month.getMonth()],
    queryFn: async () => {
      const { data } = await supabase
        .from("sessions")
        .select("started_at")
        .eq("user_id", user.id)
        .gte("started_at", startOfMonth(month).toISOString())
        .lte("started_at", endOfMonth(month).toISOString());
      return data ?? [];
    },
  });
  const trainedDays = monthSessions.map((s: any) => new Date(s.started_at));
  const trainedThisMonth = new Set(trainedDays.map((d) => format(d, "yyyy-MM-dd"))).size;

  const startSession = useMutation({
    mutationFn: async (workoutId: string) => {
      const { data, error } = await supabase
        .from("sessions")
        .insert({ user_id: user.id, workout_id: workoutId })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (s) => {
      qc.invalidateQueries({ queryKey: ["recent-sessions"] });
      navigate({ to: "/app/sessao/$id", params: { id: s.id } });
    },
  });

  // Recuperação inteligente (IA)
  const fetchRecovery = useServerFn(getRecoveryAdvice);
  const {
    data: recovery,
    isFetching: recoveryLoading,
    refetch: refetchRecovery,
  } = useQuery({
    queryKey: ["recovery", user.id],
    queryFn: () => fetchRecovery(),
    staleTime: 1000 * 60 * 60,
    retry: false,
  });

  // Esportes: exercícios do grupo "Esportes" para log rápido do dia
  const { data: sports = [] } = useQuery({
    queryKey: ["sports"],
    queryFn: async () => {
      const { data } = await supabase
        .from("exercises")
        .select("id, name")
        .eq("muscle_group", "Esportes")
        .order("name");
      return data ?? [];
    },
  });

  const [sportOpen, setSportOpen] = useState(false);
  const [sportId, setSportId] = useState<string>("");
  const [sportDuration, setSportDuration] = useState<string>("30");
  const [sportDate, setSportDate] = useState<string>(format(new Date(), "yyyy-MM-dd"));

  const logSport = useMutation({
    mutationFn: async () => {
      if (!sportId) throw new Error("Escolha um esporte");
      const dur = Number(sportDuration);
      if (!dur || dur <= 0) throw new Error("Duração inválida");
      const startedAt = new Date(`${sportDate}T12:00:00`);
      const endedAt = new Date(startedAt.getTime() + dur * 60_000);
      const { data: sess, error: sErr } = await supabase
        .from("sessions")
        .insert({
          user_id: user.id,
          workout_id: null,
          started_at: startedAt.toISOString(),
          ended_at: endedAt.toISOString(),
          notes: `Esporte · ${dur} min`,
        })
        .select()
        .single();
      if (sErr) throw sErr;
      const { error: setErr } = await supabase.from("session_sets").insert({
        session_id: sess.id,
        exercise_id: sportId,
        set_number: 1,
        reps: dur,
        completed_at: endedAt.toISOString(),
      });
      if (setErr) throw setErr;
      return sess;
    },
    onSuccess: () => {
      toast.success("Esporte registrado!");
      qc.invalidateQueries({ queryKey: ["recent-sessions"] });
      qc.invalidateQueries({ queryKey: ["month-sessions"] });
      qc.invalidateQueries({ queryKey: ["history-sessions"] });
      setSportOpen(false);
      setSportId("");
      setSportDuration("30");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const firstName = profile?.display_name?.split(" ")[0] ?? "atleta";
  const today = format(new Date(), "EEEE, d 'de' MMMM", { locale: ptBR });
  const nextWorkout = workouts[0];
  const dailyQuote = useMemo(() => getDailyQuote(new Date()), []);

  return (
    <div className="app-container pt-8 sm:pt-12">
      {/* Hero */}
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
        <div className="min-w-0">
          <p className="text-eyebrow text-muted-foreground">{today}</p>
          <h1 className="mt-2 font-display text-[2.4rem] leading-[0.95] tracking-tight">
            Oi,<br />
            <span className="text-foreground">{firstName}.</span>
          </h1>
        </div>
        <button
          onClick={() => navigate({ to: "/app/perfil" })}
          className="grid size-11 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground font-display text-sm"
        >
          {firstName.slice(0, 1).toUpperCase()}
        </button>
      </header>

      {/* Frase do dia */}
      <div className="card-lift mt-5 flex items-start gap-3 p-4 sm:p-5">
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-brand text-brand-foreground">
          <Quote className="size-4" strokeWidth={2.5} />
        </span>
        <div className="min-w-0">
          <p className="text-eyebrow text-muted-foreground">Frase do dia</p>
          <p className="mt-1 font-display text-base leading-snug text-foreground sm:text-lg">
            &ldquo;{dailyQuote.text}&rdquo;
          </p>
          <p className="mt-1 text-xs text-muted-foreground">— {dailyQuote.author}</p>
        </div>
      </div>

      {/* Recuperação inteligente (IA) */}
      <RecoveryCard
        recovery={recovery}
        loading={recoveryLoading}
        onRefresh={() => refetchRecovery()}
      />

      {/* Bento */}
      <div className="mt-6 grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4 md:gap-5">
        {/* Start workout — hero tile */}
        {nextWorkout ? (
          <button
            onClick={() => startSession.mutate(nextWorkout.id)}
            disabled={startSession.isPending}
            className="card-ink grid-noise col-span-2 row-span-2 flex flex-col items-start p-5 text-left sm:p-7 md:col-span-2 md:min-h-[280px]"
          >
            <span className="text-eyebrow text-white/60">Próximo treino</span>
            <div className="mt-3 flex flex-wrap items-end gap-3">
              <span className="font-display text-6xl font-black leading-none text-brand sm:text-7xl md:text-8xl">
                {nextWorkout.label}
              </span>
              <span className="mb-1 font-display text-xl leading-tight sm:text-2xl">{nextWorkout.name}</span>
            </div>
            <span className="mt-auto pt-6 inline-flex items-center gap-2 rounded-full bg-brand px-4 py-2 text-sm font-semibold text-brand-foreground shadow-brand">
              <Play className="size-4 fill-current" /> Iniciar agora
            </span>
          </button>
        ) : (
          <div className="card-lift col-span-2 row-span-2 flex flex-col items-start p-5 sm:p-7 md:col-span-2">
            <span className="text-eyebrow text-muted-foreground">Comece</span>
            <p className="mt-2 font-display text-2xl">Monte seu primeiro treino</p>
            <Button className="mt-4" onClick={() => navigate({ to: "/app/treinos" })}>
              <Plus className="size-4" /> Criar treino
            </Button>
          </div>
        )}

        {/* Streak / stats */}
        <div className="card-lift flex flex-col p-4 sm:p-5">
          <span className="text-eyebrow text-muted-foreground">Este mês</span>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="font-display text-4xl font-black tabular-nums sm:text-5xl">{trainedThisMonth}</span>
            <span className="text-xs text-muted-foreground">treinos</span>
          </div>
          <Flame className="mt-auto size-5 self-end text-brand" strokeWidth={2.5} />
        </div>

        {/* Coach IA */}
        <Link to="/app/coach" className="card-brand relative flex flex-col overflow-hidden p-4 sm:p-5">
          <span className="text-eyebrow opacity-70">Coach IA</span>
          <p className="mt-2 font-display text-lg leading-tight">Montar treino automático</p>
          <ArrowUpRight className="mt-auto size-5 self-end" strokeWidth={2.5} />
          <Sparkles className="pointer-events-none absolute -right-2 -top-2 size-16 opacity-15" />
        </Link>

        {/* Registrar esporte do dia */}
        <button
          onClick={() => setSportOpen(true)}
          className="card-lift col-span-2 flex items-center gap-3 p-4 text-left sm:p-5 md:col-span-2"
        >
          <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand text-brand-foreground">
            <Trophy className="size-5" strokeWidth={2.5} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-eyebrow text-muted-foreground">Praticou um esporte?</p>
            <p className="font-display text-base font-bold leading-tight">Registrar esporte do dia</p>
          </div>
          <Plus className="size-5 text-muted-foreground" strokeWidth={2.5} />
        </button>
      </div>

      {/* Dialog: registrar esporte */}
      <Dialog open={sportOpen} onOpenChange={setSportOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar esporte</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-xs">Esporte / atividade</Label>
              <Select value={sportId} onValueChange={setSportId}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Escolha um esporte" /></SelectTrigger>
                <SelectContent className="max-h-72">
                  {sports.map((s: any) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Duração (min)</Label>
                <Input
                  type="number"
                  min={1}
                  value={sportDuration}
                  onChange={(e) => setSportDuration(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs">Data</Label>
                <Input
                  type="date"
                  value={sportDate}
                  onChange={(e) => setSportDate(e.target.value)}
                  className="mt-1"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSportOpen(false)}>Cancelar</Button>
            <Button onClick={() => logSport.mutate()} disabled={logSport.isPending}>
              <Trophy className="size-4" /> Registrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Meus treinos */}
      <section className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-xl">Meus treinos</h2>
          <Link to="/app/treinos" className="text-xs font-semibold text-foreground underline underline-offset-4">
            Ver todos
          </Link>
        </div>
        {workouts.length === 0 ? (
          <div className="card-lift p-6 text-center text-sm text-muted-foreground">
            Nenhum treino ainda.
          </div>
        ) : (
          <div className="-mx-5 flex snap-x snap-mandatory gap-3 overflow-x-auto px-5 pb-2 sm:mx-0 sm:grid sm:snap-none sm:grid-cols-2 sm:overflow-visible sm:px-0 lg:grid-cols-3 xl:grid-cols-4">
            {workouts.map((w) => (
              <div key={w.id} className="card-lift flex min-w-[210px] snap-start flex-col p-4 sm:min-w-0">
                <div className="flex items-center gap-2">
                  <span className="grid size-9 place-items-center rounded-lg bg-primary font-display text-base font-black text-primary-foreground">
                    {w.label}
                  </span>
                  <Dumbbell className="size-4 text-muted-foreground" />
                </div>
                <h3 className="mt-3 font-display text-base font-bold leading-tight">{w.name}</h3>
                {w.notes && <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{w.notes}</p>}
                <div className="mt-4 flex gap-2">
                  <Button size="sm" className="flex-1" onClick={() => startSession.mutate(w.id)} disabled={startSession.isPending}>
                    <Play className="size-3.5 fill-current" /> Iniciar
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => navigate({ to: "/app/treinos/$id", params: { id: w.id } })}>
                    Editar
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Calendário + Últimas sessões side-by-side em lg */}
      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-8">

      {/* Calendário */}
      <section className="mt-0">
        <h2 className="mb-3 font-display text-xl">Calendário</h2>
        <div className="card-lift p-3">
          <Calendar
            mode="multiple"
            selected={trainedDays}
            month={month}
            onMonthChange={setMonth}
            locale={ptBR}
            className="pointer-events-auto"
            modifiersClassNames={{
              selected:
                "!bg-brand !text-brand-foreground !font-bold hover:!bg-brand hover:!text-brand-foreground",
            }}
          />
        </div>
      </section>

      {/* Últimas sessões */}
      <section className="mt-0">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-xl">Últimas sessões</h2>
          <Link to="/app/historico" className="text-xs font-semibold text-foreground underline underline-offset-4">
            Ver histórico
          </Link>
        </div>
        {recent.length === 0 ? (
          <div className="card-lift p-5 text-sm text-muted-foreground">
            Nenhuma sessão registrada ainda.
          </div>
        ) : (
          <ul className="space-y-2">
            {recent.map((s: any) => (
              <li key={s.id} className="card-lift flex items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <p className="truncate font-display text-sm font-bold">
                    {s.workouts ? `Treino ${s.workouts.label} — ${s.workouts.name}` : "Treino livre"}
                  </p>
                  <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <CalendarIcon className="size-3" />
                    {format(new Date(s.started_at), "d MMM, HH:mm", { locale: ptBR })}
                    {!s.ended_at && (
                      <span className="ml-1 rounded-full bg-brand/25 px-2 py-0.5 font-semibold text-foreground">
                        em andamento
                      </span>
                    )}
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  {!s.ended_at ? (
                    <Button size="sm" variant="outline" onClick={() => navigate({ to: "/app/sessao/$id", params: { id: s.id } })}>
                      Continuar
                    </Button>
                  ) : (
                    <Button size="sm" variant="outline" onClick={() => navigate({ to: "/app/sessao/$id/editar", params: { id: s.id } })}>
                      Editar
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
      </div>
    </div>
  );
}
