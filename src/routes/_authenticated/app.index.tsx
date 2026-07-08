import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Route as AuthedRoute } from "./route";
import { Button } from "@/components/ui/button";
import { Sparkles, Play, Plus, TrendingUp, Calendar as CalendarIcon, CalendarDays } from "lucide-react";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar } from "@/components/ui/calendar";
import { useState } from "react";

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

  const firstName = profile?.display_name?.split(" ")[0] ?? "atleta";
  const today = format(new Date(), "EEEE, d 'de' MMMM", { locale: ptBR });

  return (
    <div className="mx-auto max-w-md px-5 pt-8">
      <header>
        <p className="text-xs uppercase tracking-wider text-muted-foreground">{today}</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight">Oi, {firstName} 👋</h1>
      </header>

      <section className="mt-6">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Iniciar treino</h2>
          <Link to="/app/treinos" className="text-xs font-medium text-accent">Ver todos</Link>
        </div>
        {workouts.length === 0 ? (
          <div className="card-soft mt-3 p-6 text-center">
            <p className="text-sm text-muted-foreground">Você ainda não criou nenhum treino.</p>
            <Button className="mt-4" onClick={() => navigate({ to: "/app/treinos" })}>
              <Plus className="size-4" /> Criar meu primeiro treino
            </Button>
          </div>
        ) : (
          <div className="mt-3 flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2 -mx-5 px-5">
            {workouts.map((w) => (
              <div key={w.id} className="card-soft flex min-w-[220px] snap-start flex-col p-4">
                <span className="inline-flex size-8 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
                  {w.label}
                </span>
                <h3 className="mt-3 font-semibold leading-tight">{w.name}</h3>
                {w.notes && <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{w.notes}</p>}
                <div className="mt-4 flex gap-2">
                  <Button size="sm" className="flex-1" onClick={() => startSession.mutate(w.id)} disabled={startSession.isPending}>
                    <Play className="size-3.5" /> Iniciar
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

      <section className="mt-8">
        <Link to="/app/coach" className="card-soft flex items-center gap-4 p-4 transition-colors hover:bg-secondary/40">
          <div className="grid size-11 place-items-center rounded-xl bg-accent text-accent-foreground">
            <Sparkles className="size-5" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold leading-tight">Coach de IA</h3>
            <p className="text-xs text-muted-foreground">Sugestões de treino, descanso e progressão</p>
          </div>
        </Link>
      </section>

      <section className="mt-8">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
          <TrendingUp className="size-4" /> Últimas sessões
        </h2>
        {recent.length === 0 ? (
          <div className="card-soft p-5 text-sm text-muted-foreground">
            Nenhuma sessão registrada ainda.
          </div>
        ) : (
          <ul className="space-y-2">
            {recent.map((s: any) => (
              <li key={s.id} className="card-soft flex items-center justify-between p-4">
                <div>
                  <p className="text-sm font-semibold">
                    {s.workouts ? `Treino ${s.workouts.label} — ${s.workouts.name}` : "Treino livre"}
                  </p>
                  <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                    <CalendarIcon className="size-3" />
                    {format(new Date(s.started_at), "d MMM, HH:mm", { locale: ptBR })}
                    {!s.ended_at && <span className="ml-2 rounded-full bg-accent/15 px-2 py-0.5 font-medium text-accent">em andamento</span>}
                  </p>
                </div>
                {!s.ended_at && (
                  <Button size="sm" variant="outline" onClick={() => navigate({ to: "/app/sessao/$id", params: { id: s.id } })}>
                    Continuar
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
