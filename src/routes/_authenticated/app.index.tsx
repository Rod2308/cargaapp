import { bridged } from "@/lib/server-bridge";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Route as AuthedRoute } from "./route";
import { Button } from "@/components/ui/button";
import { Play, Plus, Flame, Calendar as CalendarIcon, Dumbbell, Quote, Trophy, HeartPulse, RefreshCw, Moon, Pencil, History } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
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

import { sessionTitle, sessionSubtitle, isCardioSession } from "@/lib/session-display";
import { computeCyclePhase } from "@/lib/cycle";
import { CardioRecoveryAlert } from "@/components/CardioRecoveryAlert";
import { RetroWorkoutDialog } from "@/components/RetroWorkoutDialog";
import { DailyCheckinCard } from "@/components/DailyCheckinCard";
import { DailySuggestionCard } from "@/components/DailySuggestionCard";
import {
  sugerirTreinoDoDia,
  sugerirTreinoDoPlano,
  melhorWorkoutParaSugestao,
  proximoNaRotina,
  MUSCLE_LABEL,
  type MuscleGroup,
  type WorkoutSession,
  type ExtraActivity,
} from "@/lib/daily-suggestion";



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

  const { data: workouts = [], isLoading: workoutsLoading } = useQuery({
    queryKey: ["workouts", user.id],
    queryFn: async () => {
      const { data } = await supabase.from("workouts").select("*").eq("user_id", user.id).order("order_idx");
      return data ?? [];
    },
  });

  // Último treino do plano efetivamente concluído (independe de check-in diário).
  // Prefixo "recent-sessions" para ser invalidado junto com as demais telas.
  const { data: lastPlanSession, isLoading: lastPlanLoading } = useQuery({
    queryKey: ["recent-sessions", user.id, "last-plan"],
    queryFn: async () => {
      const { data } = await supabase
        .from("sessions")
        .select("workout_id, started_at, ended_at")
        .eq("user_id", user.id)
        .not("workout_id", "is", null)
        .order("started_at", { ascending: false })
        .limit(1);
      return data?.[0] ?? null;
    },
  });



  const { data: recent = [] } = useQuery({
    queryKey: ["recent-sessions", user.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("sessions")
        .select("id, started_at, ended_at, notes, workout_id, title, source, activity_type, distance_m, workouts(name, label), session_sets(reps, weight_kg, exercises(name, muscle_group))")
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

  const todayForMonth = new Date();
  const { data: currentMonthSessions = [] } = useQuery({
    queryKey: ["month-sessions", user.id, todayForMonth.getFullYear(), todayForMonth.getMonth()],
    queryFn: async () => {
      const { data } = await supabase
        .from("sessions")
        .select("started_at")
        .eq("user_id", user.id)
        .gte("started_at", startOfMonth(todayForMonth).toISOString())
        .lte("started_at", endOfMonth(todayForMonth).toISOString());
      return data ?? [];
    },
  });
  const trainedThisMonth = new Set(
    currentMonthSessions.map((s: any) => format(new Date(s.started_at), "yyyy-MM-dd")),
  ).size;

  const startSession = useMutation({
    mutationFn: async ({ workoutId, dateStr }: { workoutId: string; dateStr?: string }) => {
      const payload: { user_id: string; workout_id: string; started_at?: string; ended_at?: string } = {
        user_id: user.id,
        workout_id: workoutId,
      };
      if (dateStr) {
        // Sessão retroativa: marca começo às 12:00 do dia escolhido e já finaliza,
        // pra usuário só preencher as séries na tela de edição.
        const startedAt = new Date(`${dateStr}T12:00:00`);
        payload.started_at = startedAt.toISOString();
        payload.ended_at = new Date(startedAt.getTime() + 60 * 60_000).toISOString();
      }
      const { data, error } = await supabase
        .from("sessions")
        .insert(payload)
        .select()
        .single();
      if (error) throw error;
      return { session: data, retro: !!dateStr };
    },
    onSuccess: ({ session, retro }) => {
      qc.invalidateQueries({ queryKey: ["recent-sessions"] });
      qc.invalidateQueries({ queryKey: ["month-sessions"] });
      qc.invalidateQueries({ queryKey: ["history-sessions"] });
      qc.invalidateQueries({ queryKey: ["recovery"] });
      navigate({
        to: retro ? "/app/sessao/$id/editar" : "/app/sessao/$id",
        params: { id: session.id },
      });
    },
  });

  // Data atual (usada como chave de cache — vira ao passar da meia-noite)
  const todayStr = format(new Date(), "yyyy-MM-dd");

  // Recuperação — inclui o dia atual na chave para que, se o usuário não
  // treinar hoje, o score recalcule considerando o dia corrido como
  // "não treinado".
  const fetchRecovery = bridged("recovery.get", getRecoveryAdvice);
  const {
    data: recovery,
    isFetching: recoveryLoading,
    refetch: refetchRecovery,
  } = useQuery({
    queryKey: ["recovery", user.id, todayStr],
    queryFn: async () => {
      // Em origens espelho (ex.: Vercel) o app é servido como estático e as
      // server functions não existem — nesse caso calculamos a recuperação no
      // próprio navegador, com exatamente o mesmo motor usado no servidor.
      try {
        return await fetchRecovery();
      } catch (err) {
        console.warn("[recovery] server function indisponível, calculando localmente", err);
        const { computeRecoveryAdviceFor } = await import("@/lib/recovery-core");
        return await computeRecoveryAdviceFor(supabase, user.id);
      }
    },
    staleTime: 1000 * 60 * 30,
    refetchOnWindowFocus: true,
    retry: false,
  });

  // Check-in diário (para sugestão do dia)
  const { data: todayCheckin } = useQuery({
    queryKey: ["daily-checkin", user.id, todayStr],
    queryFn: async () => {
      const { data } = await supabase
        .from("daily_checkins")
        .select("sleep_hours, sleep_quality, soreness, energy")
        .eq("user_id", user.id)
        .eq("log_date", todayStr)
        .maybeSingle();
      return data;
    },
  });

  // Sessões dos últimos 7 dias (para timeline de esforço)
  const { data: last7Sessions = [] } = useQuery({
    queryKey: ["last7-sessions", user.id, todayStr],
    queryFn: async () => {
      const since = new Date(Date.now() - 7 * 86400_000).toISOString();
      const { data } = await supabase
        .from("sessions")
        .select("id, started_at, ended_at, workout_id, notes, title, source, activity_type, distance_m, workouts(name, label), session_sets(exercises(name, muscle_group))")
        .eq("user_id", user.id)
        .gte("started_at", since)
        .order("started_at", { ascending: false });
      return data ?? [];
    },
  });

  const planoOuGeral = useMemo(() => {
    if (!todayCheckin) return { suggestion: null, workoutId: null as string | null };
    const sessoes: WorkoutSession[] = [];
    const extras: ExtraActivity[] = [];
    for (const s of last7Sessions as any[]) {
      const groups = new Set<string>();
      const strengthGroups = new Set<string>();
      const sportNames: string[] = [];
      for (const st of s.session_sets ?? []) {
        const g = st.exercises?.muscle_group;
        if (g) {
          groups.add(g);
          if (g === "Esportes") {
            if (st.exercises?.name) sportNames.push(st.exercises.name);
          } else {
            strengthGroups.add(g);
          }
        }
      }
      const cardio = isCardioSession(s);
      const dur = s.ended_at
        ? Math.max(0, (new Date(s.ended_at).getTime() - new Date(s.started_at).getTime()) / 60000)
        : null;

      // Sempre conta como cardio quando a sessão é cardio (importada, vinculada ou livre)
      if (cardio) {
        const name =
          sportNames[0] ??
          s.title ??
          s.activity_type ??
          s.workouts?.name ??
          "cardio";
        extras.push({
          started_at: s.started_at,
          ended_at: s.ended_at,
          activity_name: name,
          duration_min: dur,
        });
      }

      // Se também tem componente de força (grupos musculares além de Esportes), conta como treino
      if (strengthGroups.size > 0 || (!cardio && s.workout_id)) {
        sessoes.push({
          started_at: s.started_at,
          ended_at: s.ended_at,
          workout_label: s.workouts?.label ?? null,
          workout_name: s.workouts?.name ?? null,
          muscle_groups: Array.from(strengthGroups.size > 0 ? strengthGroups : groups),
        });
      }
    }


    // 1) Tenta rotação pelo plano (A/B/C...) — avança para o próximo treino
    // com base no último realmente feito.
    const planoWorkouts = (workouts as any[])
      .filter((w) => w.label && /^[A-Z]$/i.test(String(w.label).trim()))
      .map((w) => ({ id: w.id, label: w.label, name: w.name }));
    const doPlano = planoWorkouts.length >= 2
      ? sugerirTreinoDoPlano({
          workouts: planoWorkouts,
          sessoes,
          atividadesExtras: extras,
          checkin: todayCheckin,
        })
      : null;
    if (doPlano) {
      return { suggestion: doPlano.sugestao, workoutId: doPlano.workoutId };
    }

    // 2) Fallback: sugestão por análise de recuperação (grupos musculares)
    const geral = sugerirTreinoDoDia({
      sessoes,
      atividadesExtras: extras,
      checkin: todayCheckin,
    });
    const wList = (workouts as any[]).map((w) => {
      const hay = `${w.label} ${w.name}`.toLowerCase();
      const guesses: string[] = [];
      if (/peito|chest/.test(hay)) guesses.push("Peito");
      if (/cost|dorsal|back|puxada/.test(hay)) guesses.push("Costas");
      if (/perna|quad|leg|posterior/.test(hay)) guesses.push("Pernas");
      if (/ombro|shoulder|delto/.test(hay)) guesses.push("Ombro");
      if (/bicep/.test(hay)) guesses.push("Bíceps");
      if (/tricep/.test(hay)) guesses.push("Tríceps");
      if (/gluteo|butt/.test(hay)) guesses.push("Glúteo");
      if (/abdom|core/.test(hay)) guesses.push("Abdômen");
      if (/superior|upper|push|pull/.test(hay)) guesses.push("Peito", "Costas", "Ombro");
      if (/inferior|lower/.test(hay)) guesses.push("Pernas", "Glúteo");
      return { id: w.id, label: w.label, name: w.name, muscle_groups: guesses };
    });
    const wid = geral.grupos.length > 0 ? melhorWorkoutParaSugestao(wList, geral.grupos) : null;
    // Alinha os grupos exibidos aos grupos reais do treino do plano escolhido —
    // evita sugerir combinações (ex: Ombro + Tríceps) que não existem no split do usuário.
    let ajustada = geral;
    if (wid) {
      const w = wList.find((x) => x.id === wid);
      if (w && w.muscle_groups.length > 0) {
        const map: Record<string, typeof geral.grupos[number]> = {
          Peito: "peito", Costas: "costas", Pernas: "pernas", Ombro: "ombro",
          "Bíceps": "biceps", "Tríceps": "triceps", "Glúteo": "gluteo", "Abdômen": "abdomen",
        };
        const gruposReais = Array.from(new Set(w.muscle_groups.map((g) => map[g]).filter(Boolean)));
        if (gruposReais.length > 0) {
          ajustada = { ...geral, grupos: gruposReais as typeof geral.grupos };
        }
      }
    }
    return { suggestion: ajustada, workoutId: wid };

  }, [todayCheckin, last7Sessions, workouts]);

  const suggestion = planoOuGeral.suggestion;
  const workoutSugeridoId = planoOuGeral.workoutId;

  const [checkinEditOpen, setCheckinEditOpen] = useState(false);

  // Renomear sessão inline nas "Últimas sessões"
  const qcRoot = useQueryClient();
  const [renaming, setRenaming] = useState<{ id: string; current: string } | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const renameSession = useMutation({
    mutationFn: async ({ id, title }: { id: string; title: string | null }) => {
      const { error } = await supabase.from("sessions").update({ title }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Nome atualizado");
      setRenaming(null);
      qcRoot.invalidateQueries({ queryKey: ["recent-sessions"] });
      qcRoot.invalidateQueries({ queryKey: ["history-sessions"] });
    },
    onError: (e: any) => toast.error(e.message),
  });



  // Sono — últimos 7 dias e log de hoje
  const { data: sleepLogs = [] } = useQuery({
    queryKey: ["sleep-logs", user.id],
    queryFn: async () => {
      const since = format(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), "yyyy-MM-dd");
      const { data } = await supabase
        .from("sleep_logs")
        .select("log_date, hours, quality")
        .eq("user_id", user.id)
        .gte("log_date", since)
        .order("log_date", { ascending: false });
      return data ?? [];
    },
  });
  const todaySleep = sleepLogs.find((s: any) => s.log_date === todayStr);
  const sleepAvg7 =
    sleepLogs.length > 0
      ? sleepLogs.reduce((a: number, s: any) => a + Number(s.hours), 0) / sleepLogs.length
      : null;

  const logSleep = useMutation({
    mutationFn: async ({ hours, quality }: { hours: number; quality?: number | null }) => {
      const { writeUpsert } = await import("@/lib/offline-writes");
      await writeUpsert(
        "sleep_logs",
        { user_id: user.id, log_date: todayStr, hours, quality: quality ?? null },
        { onConflict: "user_id,log_date" },
      );
      return { hours, quality: quality ?? null };
    },
    onMutate: async ({ hours, quality }) => {
      await qc.cancelQueries({ queryKey: ["sleep-logs", user.id] });
      const prev = qc.getQueryData<any[]>(["sleep-logs", user.id]);
      qc.setQueryData<any[]>(["sleep-logs", user.id], (old = []) => {
        const filtered = old.filter((s: any) => s.log_date !== todayStr);
        return [{ log_date: todayStr, hours, quality: quality ?? null }, ...filtered];
      });
      return { prev };
    },
    onError: (e: any, _v, ctx: any) => {
      if (ctx?.prev) qc.setQueryData(["sleep-logs", user.id], ctx.prev);
      toast.error(e.message);
    },
    onSuccess: () => {
      toast.success("Sono registrado!");
      qc.invalidateQueries({ queryKey: ["sleep-logs"] });
      qc.invalidateQueries({ queryKey: ["recovery"] });
    },
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
  // "Próximo treino":
  // 1) sugestão inteligente (rotação do plano + recuperação muscular), quando há check-in;
  // 2) senão, rotação pura pelo último treino concluído (A → B → C → A);
  // 3) senão, primeiro treino da rotina.
  const nextWorkout = useMemo(() => {
    if (workoutSugeridoId) {
      const w = (workouts as any[]).find((x) => x.id === workoutSugeridoId);
      if (w) return w;
    }
    return (
      proximoNaRotina(workouts as any[], lastPlanSession?.workout_id ?? null) ??
      (workouts[0] as any)
    );
  }, [workouts, workoutSugeridoId, lastPlanSession]);

  const nextWorkoutLoading = workoutsLoading || lastPlanLoading;
  const isRestDay = suggestion?.intensidade === "descanso";

  // Contagem de exercícios do próximo treino (informação de apoio no card)
  const { data: nextWorkoutExerciseCount } = useQuery({
    queryKey: ["workout-exercise-count", nextWorkout?.id],
    enabled: !!nextWorkout?.id,
    queryFn: async () => {
      const { count } = await supabase
        .from("workout_exercises")
        .select("id", { count: "exact", head: true })
        .eq("workout_id", nextWorkout.id);
      return count ?? 0;
    },
  });

  // Por que este treino? — grupo(s), recuperação e origem da sugestão
  const nextWorkoutReason = useMemo(() => {
    if (!nextWorkout) return null;
    const usouSugestao = !!workoutSugeridoId && workoutSugeridoId === nextWorkout.id;

    const hay = `${nextWorkout.label ?? ""} ${nextWorkout.name ?? ""}`
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
    const inferidos: MuscleGroup[] = [];
    if (/peito|chest/.test(hay)) inferidos.push("peito");
    if (/costa|dorsal|back|puxada/.test(hay)) inferidos.push("costas");
    if (/perna|quad|leg|posterior|panturr/.test(hay)) inferidos.push("pernas");
    if (/ombro|shoulder|delto/.test(hay)) inferidos.push("ombro");
    if (/bicep/.test(hay)) inferidos.push("biceps");
    if (/tricep/.test(hay)) inferidos.push("triceps");
    if (/gluteo/.test(hay)) inferidos.push("gluteo");
    if (/abdom|core|abs/.test(hay)) inferidos.push("abdomen");

    const grupos = (usouSugestao && suggestion?.grupos?.length ? suggestion.grupos : inferidos)
      .filter((g, i, arr) => arr.indexOf(g) === i)
      .map((g) => MUSCLE_LABEL[g as MuscleGroup] ?? String(g));

    const origem = usouSugestao
      ? "Sugestão do dia (plano + recuperação)"
      : lastPlanSession?.workout_id
        ? "Rotação do plano após o último treino"
        : "Primeiro treino da sua rotina";

    const recuperacao = suggestion
      ? `Score ${suggestion.score.toFixed(1)}/10 · intensidade ${suggestion.intensidade}`
      : null;

    return {
      grupos,
      origem,
      recuperacao,
      scoreDetalhe: suggestion?.scoreDetalhe ?? null,
      motivo: usouSugestao ? suggestion?.motivo ?? null : null,
    };
  }, [nextWorkout, workoutSugeridoId, suggestion, lastPlanSession]);


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

      <div className="mt-4">
        <CardioRecoveryAlert userId={user.id} />
      </div>

      {/* Frase do dia */}
      <div className="card-lift mt-4 flex items-start gap-3 p-4 sm:p-5">
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

      {/* Recuperação */}
      <RecoveryCard
        recovery={recovery}
        loading={recoveryLoading}
        onRefresh={() => refetchRecovery()}
      />

      {/* Sugestão do dia — 100% lógica local */}
      {!todayCheckin || checkinEditOpen ? (
        <DailyCheckinCard
          userId={user.id}
          todayStr={todayStr}
          initial={todayCheckin ?? null}
          onSaved={() => setCheckinEditOpen(false)}
        />
      ) : suggestion ? (
        <DailySuggestionCard
          sugestao={suggestion}
          workoutSugeridoId={workoutSugeridoId}
          onEditCheckin={() => setCheckinEditOpen(true)}
          onStart={() => {
            if (suggestion.intensidade === "descanso") {
              setSportOpen(true);
            } else if (workoutSugeridoId) {
              startSession.mutate({ workoutId: workoutSugeridoId });
            } else {
              navigate({ to: "/app/treinos" });
            }
          }}
        />
      ) : null}
      {/* Ciclo menstrual (se ativado) */}
      <CycleCard profile={profile} />

      {/* Sono de hoje */}
      <SleepCard
        todayHours={todaySleep?.hours ?? null}
        todayQuality={todaySleep?.quality ?? null}
        avg7={sleepAvg7}
        onLog={(hours, quality) => logSleep.mutate({ hours, quality })}
        pending={logSleep.isPending}
      />


      {/* Bento */}
      <div className="mt-4 grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
        {/* Start workout — hero tile */}
        {nextWorkoutLoading ? (
          <div className="card-lift col-span-2 row-span-2 flex flex-col items-start gap-4 p-5 sm:p-7 md:col-span-2 md:min-h-[280px]">
            <div className="h-3 w-28 animate-pulse rounded-full bg-muted" />
            <div className="h-16 w-40 animate-pulse rounded-2xl bg-muted" />
            <div className="h-4 w-48 animate-pulse rounded-full bg-muted" />
            <div className="mt-auto h-10 w-36 animate-pulse rounded-full bg-muted" />
          </div>
        ) : nextWorkout ? (
          <button
            onClick={() => startSession.mutate({ workoutId: nextWorkout.id })}
            disabled={startSession.isPending}
            className="card-ink grid-noise col-span-2 row-span-2 flex flex-col items-start p-5 text-left transition-opacity duration-300 sm:p-7 md:col-span-2 md:min-h-[280px]"
          >
            <span className="text-eyebrow text-white/60">Seu próximo treino</span>
            <div className="mt-3 flex flex-wrap items-end gap-3">
              <span className="font-display text-6xl font-black leading-none text-brand sm:text-7xl md:text-8xl">
                {nextWorkout.label}
              </span>
              <span className="mb-1 font-display text-xl leading-tight sm:text-2xl">{nextWorkout.name}</span>
            </div>
            <span className="mt-2 text-xs text-white/60">
              {isRestDay
                ? "Hoje é dia de descanso — mantenha o foco na recuperação. Se quiser, treine leve."
                : [
                    lastPlanSession?.workout_id
                      ? `Depois do último treino registrado`
                      : "Primeiro treino da sua rotina",
                    nextWorkoutExerciseCount
                      ? `${nextWorkoutExerciseCount} exercício${nextWorkoutExerciseCount > 1 ? "s" : ""}`
                      : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
            </span>

            {/* Motivo da escolha */}
            {nextWorkoutReason ? (
              <div className="mt-4 w-full rounded-2xl bg-white/5 p-3">
                <span className="text-eyebrow text-white/50">Por que este treino?</span>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {nextWorkoutReason.grupos.length > 0 ? (
                    <span className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] text-white/80">
                      Grupo: {nextWorkoutReason.grupos.join(", ")}
                    </span>
                  ) : null}
                  {nextWorkoutReason.recuperacao ? (
                    <span className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] text-white/80">
                      Recuperação: {nextWorkoutReason.recuperacao}
                    </span>
                  ) : null}
                  <span className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] text-white/80">
                    Sugestão: {nextWorkoutReason.origem}
                  </span>
                </div>
                {nextWorkoutReason.motivo ? (
                  <p className="mt-2 text-[11px] leading-snug text-white/60">{nextWorkoutReason.motivo}</p>
                ) : null}
                {nextWorkoutReason.scoreDetalhe ? (
                  <p className="mt-1 text-[11px] leading-snug text-white/40">{nextWorkoutReason.scoreDetalhe}</p>
                ) : null}
              </div>
            ) : null}

            <span className="mt-auto pt-6 inline-flex items-center gap-2 rounded-full bg-brand px-4 py-2 text-sm font-semibold text-brand-foreground shadow-brand">
              <Play className="size-4 fill-current" /> Iniciar treino
            </span>
          </button>
        ) : (
          <div className="card-lift col-span-2 row-span-2 flex flex-col items-start p-5 sm:p-7 md:col-span-2">
            <span className="text-eyebrow text-muted-foreground">Nenhum treino agendado</span>
            <p className="mt-2 font-display text-2xl">Crie sua rotina de treinos</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Monte seus treinos (A, B, C…) e o app passa a indicar automaticamente o próximo da sequência.
            </p>
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
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="font-display text-xl">Meus treinos</h2>
          <div className="flex items-center gap-3">
            <RetroWorkoutDialog userId={user.id} triggerLabel="Marcar treino esquecido" />
            <Link to="/app/treinos" className="text-xs font-semibold text-foreground underline underline-offset-4">
              Ver todos
            </Link>
          </div>
        </div>
        {workouts.length === 0 ? (
          <EmptyState
            icon={Dumbbell}
            title="Nenhum treino ainda"
            message="Crie seu primeiro treino em Treinos para começar."
          />
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
                  <Button size="sm" className="flex-1" onClick={() => startSession.mutate({ workoutId: w.id })} disabled={startSession.isPending}>
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
      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">

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
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="font-display text-xl">Últimas sessões</h2>
          <div className="flex items-center gap-3">
            <Link to="/app/progresso" className="text-xs font-semibold text-foreground underline underline-offset-4">
              Progresso
            </Link>
            <Link to="/app/historico" className="text-xs font-semibold text-foreground underline underline-offset-4">
              Histórico
            </Link>
          </div>
        </div>
        {recent.length === 0 ? (
          <EmptyState
            compact
            icon={History}
            title="Sem sessões ainda"
            message="Inicie um treino ou marque um treino esquecido para preencher aqui."
          />
        ) : (
          <ul className="space-y-2">
            {recent.map((s: any) => (
              <li key={s.id} className="card-lift flex items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <p className="flex items-center gap-2 truncate font-display text-sm font-bold">
                    <span className="truncate">{sessionTitle(s)}</span>
                    {isCardioSession(s) && (
                      <span className="shrink-0 rounded-full bg-sky-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-sky-600 dark:text-sky-400">
                        Cardio
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        const current = sessionTitle(s);
                        setRenameValue(s.title ?? current);
                        setRenaming({ id: s.id, current });
                      }}
                      className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
                      aria-label="Renomear sessão"
                      title="Renomear"
                    >
                      <Pencil className="size-3.5" />
                    </button>
                  </p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                    <CalendarIcon className="size-3" />
                    {format(new Date(s.started_at), "d MMM, HH:mm", { locale: ptBR })}
                    {sessionSubtitle(s) && <><span>·</span><span>{sessionSubtitle(s)}</span></>}
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

      {/* Dialog de renomear sessão */}
      <Dialog open={!!renaming} onOpenChange={(o) => !o && setRenaming(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Renomear sessão</DialogTitle>
          </DialogHeader>
          {renaming && (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Nome atual: <span className="font-medium text-foreground">{renaming.current}</span>
              </p>
              <Input
                autoFocus
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value.slice(0, 80))}
                placeholder="Ex: Corrida no parque, Treino de peito…"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && renaming) {
                    const v = renameValue.trim();
                    renameSession.mutate({ id: renaming.id, title: v ? v.slice(0, 80) : null });
                  }
                }}
              />
              <p className="text-[11px] text-muted-foreground">
                Deixe em branco para restaurar o nome automático.
              </p>
            </div>
          )}
          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              variant="outline"
              onClick={() => renaming && renameSession.mutate({ id: renaming.id, title: null })}
              disabled={renameSession.isPending}
            >
              Restaurar padrão
            </Button>
            <Button
              onClick={() => {
                if (!renaming) return;
                const v = renameValue.trim();
                renameSession.mutate({ id: renaming.id, title: v ? v.slice(0, 80) : null });
              }}
              disabled={renameSession.isPending}
            >
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

type RecoveryData = {
  status: "recuperado" | "leve" | "cuidado" | "descanso";
  score: number;
  intensityPct: number;
  intensityLabel: string;
  headline: string;
  reason: string;
  recommendation: string;
  tip: string;
  canDo: string[];
  avoid: string[];
  factors: { key: string; label: string; detail: string; impact: number }[];
  ignoredFactors?: { key: string; label: string; reason: string }[];
};

function RecoveryCard({
  recovery,
  loading,
  onRefresh,
}: {
  recovery: RecoveryData | undefined;
  loading: boolean;
  onRefresh: () => void;
}) {
  const styles: Record<RecoveryData["status"], { bar: string; badge: string; label: string }> = {
    recuperado: { bar: "bg-emerald-500", badge: "bg-emerald-500/15 text-emerald-500", label: "Excelente" },
    leve: { bar: "bg-brand", badge: "bg-brand/20 text-foreground", label: "Boa" },
    cuidado: { bar: "bg-amber-500", badge: "bg-amber-500/15 text-amber-500", label: "Moderada" },
    descanso: { bar: "bg-destructive", badge: "bg-destructive/15 text-destructive", label: "Baixa" },
  };
  const s = recovery ? styles[recovery.status] : styles.leve;
  const allFactors = (recovery?.factors ?? []).slice().sort((a, b) => b.impact - a.impact);
  const topFactors = allFactors;
  const ignoredFactors = recovery?.ignoredFactors ?? [];

  return (
    <div className="card-lift relative mt-4 overflow-hidden p-4 sm:p-5">
      <span className={`absolute inset-y-0 left-0 w-1 ${s.bar}`} aria-hidden />
      <div className="flex items-start gap-3 pl-2">
        <span className={`grid size-9 shrink-0 place-items-center rounded-full ${s.badge}`}>
          <HeartPulse className="size-4" strokeWidth={2.5} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <p className="text-eyebrow text-muted-foreground uppercase">Recuperação</p>
              {recovery && (
                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${s.badge}`}>
                  {s.label}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {recovery && (
                <span className={`inline-flex items-baseline gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${s.badge}`}>
                  <span className="tabular-nums">{recovery.score}</span>
                  <span className="opacity-60">/100</span>
                </span>
              )}
              <button
                onClick={onRefresh}
                disabled={loading}
                className="grid size-7 place-items-center rounded-full text-muted-foreground hover:bg-secondary hover:text-foreground disabled:opacity-50"
                aria-label="Recalcular"
              >
                <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} strokeWidth={2.5} />
              </button>
            </div>
          </div>

          {loading && !recovery ? (
            <p className="mt-1 text-sm text-muted-foreground">Analisando seus últimos treinos…</p>
          ) : recovery ? (
            <>
              <p className="mt-1 font-display text-base leading-snug text-foreground sm:text-lg">
                {recovery.headline}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">{recovery.reason}</p>

              {/* Barra de intensidade sugerida */}
              <div className="mt-3">
                <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  <span>Intensidade sugerida</span>
                  <span className="tabular-nums text-foreground">{recovery.intensityPct}%</span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-secondary">
                  <div
                    className={`h-full ${s.bar} transition-all`}
                    style={{ width: `${recovery.intensityPct}%` }}
                  />
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground">{recovery.intensityLabel}</p>
              </div>

              <p className="mt-3 flex items-start gap-1.5 text-xs font-medium text-foreground">
                <span className={`mt-0.5 inline-block h-2 w-2 shrink-0 rounded-full ${s.bar}`} />
                {recovery.recommendation}
              </p>

              {/* Pode fazer / Evitar */}
              {(recovery.canDo.length > 0 || recovery.avoid.length > 0) && (
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {recovery.canDo.length > 0 && (
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-600">Pode fazer</p>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {recovery.canDo.map((g) => (
                          <span key={g} className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-400">
                            {g}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {recovery.avoid.length > 0 && (
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-destructive">Evite</p>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {recovery.avoid.map((g) => (
                          <span key={g} className="rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-medium text-destructive">
                            {g}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Fatores considerados no cálculo */}
              {(topFactors.length > 0 || ignoredFactors.length > 0) && (
                <details className="mt-3 group">
                  <summary className="cursor-pointer list-none text-[10px] font-semibold uppercase tracking-wide text-muted-foreground hover:text-foreground">
                    Como o score foi calculado ({topFactors.length} fator{topFactors.length === 1 ? "" : "es"}
                    {ignoredFactors.length > 0 ? ` · ${ignoredFactors.length} ignorado${ignoredFactors.length === 1 ? "" : "s"}` : ""})
                  </summary>

                  {topFactors.length > 0 && (
                    <>
                      <p className="mt-2 text-[10px] uppercase tracking-wide text-muted-foreground">Fatores usados</p>
                      <ul className="mt-1 space-y-1">
                        {topFactors.map((f) => (
                          <li key={f.key} className="flex items-start justify-between gap-2 text-[11px]">
                            <div className="min-w-0">
                              <p className="font-medium text-foreground">{f.label}</p>
                              <p className="truncate text-muted-foreground">{f.detail}</p>
                            </div>
                            <span className="shrink-0 rounded-full bg-secondary px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-muted-foreground">
                              {f.impact > 0 ? `−${f.impact}` : "0"}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </>
                  )}

                  {ignoredFactors.length > 0 && (
                    <>
                      <p className="mt-3 text-[10px] uppercase tracking-wide text-muted-foreground">Fatores ignorados</p>
                      <ul className="mt-1 space-y-1">
                        {ignoredFactors.map((f) => (
                          <li key={f.key} className="flex items-start justify-between gap-2 text-[11px]">
                            <div className="min-w-0">
                              <p className="font-medium text-muted-foreground line-through decoration-muted-foreground/40">
                                {f.label}
                              </p>
                              <p className="text-muted-foreground">{f.reason}</p>
                            </div>
                            <span className="shrink-0 rounded-full bg-secondary/60 px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
                              n/a
                            </span>
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                </details>
              )}

              {/* Dica prática */}
              {recovery.tip && (
                <p className="mt-3 rounded-lg bg-secondary/60 px-3 py-2 text-[11px] leading-snug text-foreground">
                  💡 <span className="font-medium">Dica:</span> {recovery.tip}
                </p>
              )}

              <span className={`mt-3 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${s.badge}`}>
                {s.label}
              </span>
            </>
          ) : (
            <p className="mt-1 text-sm text-muted-foreground">Sem análise disponível.</p>
          )}
        </div>
      </div>
    </div>
  );
}




function SleepCard({
  todayHours,
  todayQuality,
  avg7,
  onLog,
  pending,
}: {
  todayHours: number | null;
  todayQuality: number | null;
  avg7: number | null;
  onLog: (hours: number, quality?: number | null) => void;
  pending: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [hours, setHours] = useState<string>(todayHours != null ? String(todayHours) : "8");
  const [quality, setQuality] = useState<number>(todayQuality ?? 4);

  const status =
    todayHours == null
      ? { color: "bg-muted", label: "Sem registro" }
      : todayHours < 6
        ? { color: "bg-destructive", label: "Pouco sono" }
        : todayHours < 7
          ? { color: "bg-amber-500", label: "Sono baixo" }
          : todayHours <= 9
            ? { color: "bg-emerald-500", label: "Sono ideal" }
            : { color: "bg-brand", label: "Muito sono" };

  const quick = [5, 6, 7, 8, 9];

  return (
    <div className="card-lift relative mt-4 overflow-hidden p-4 sm:p-5">
      <span className={`absolute inset-y-0 left-0 w-1 ${status.color}`} aria-hidden />
      <div className="flex items-start gap-3 pl-2">
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-secondary text-foreground">
          <span className="text-lg leading-none">💤</span>
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="text-eyebrow text-muted-foreground">Sono de hoje</p>
            <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              {avg7 != null ? `média 7d ${avg7.toFixed(1)}h` : "sem histórico"}
            </span>
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="font-display text-2xl font-black tabular-nums text-foreground">
              {todayHours != null ? `${todayHours}h` : "—"}
            </span>
            <span className="text-xs text-muted-foreground">{status.label}</span>
            {todayQuality != null && (
              <span className="text-xs text-muted-foreground">· qualidade {todayQuality}/5</span>
            )}
          </div>

          <div className="mt-3 flex flex-wrap gap-1.5">
            {quick.map((h) => (
              <button
                key={h}
                onClick={() => onLog(h, quality)}
                disabled={pending}
                className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                  todayHours === h
                    ? "border-brand bg-brand text-brand-foreground"
                    : "border-border bg-background hover:bg-secondary"
                }`}
              >
                {h}h
              </button>
            ))}
            <button
              onClick={() => setOpen(true)}
              className="rounded-full border border-border bg-background px-3 py-1 text-xs font-semibold hover:bg-secondary"
            >
              Ajustar…
            </button>
          </div>
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar sono de hoje</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-xs">Horas dormidas</Label>
              <Input
                type="number"
                step="0.5"
                min={0}
                max={24}
                value={hours}
                onChange={(e) => setHours(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-xs">Qualidade (1-5)</Label>
              <div className="mt-1 flex gap-2">
                {[1, 2, 3, 4, 5].map((q) => (
                  <button
                    key={q}
                    onClick={() => setQuality(q)}
                    className={`h-10 flex-1 rounded-md border text-sm font-semibold ${
                      quality === q
                        ? "border-brand bg-brand text-brand-foreground"
                        : "border-border bg-background hover:bg-secondary"
                    }`}
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button
              onClick={() => {
                const h = Number(hours);
                if (!h || h <= 0 || h > 24) {
                  toast.error("Horas inválidas");
                  return;
                }
                onLog(h, quality);
                setOpen(false);
              }}
              disabled={pending}
            >
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CycleCard({ profile }: { profile: any }) {
  if (!profile?.cycle_tracking_enabled || profile?.sex !== "feminino") return null;
  const info = computeCyclePhase({
    lastPeriodStart: profile.cycle_last_period_start,
    cycleLength: profile.cycle_length_days,
    periodLength: profile.cycle_period_length_days,
  });
  if (!info) {
    return (
      <div className="card-lift relative mt-4 overflow-hidden p-4 sm:p-5">
        <span className="absolute inset-y-0 left-0 w-1 bg-muted" aria-hidden />
        <div className="flex items-start gap-3 pl-2">
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-secondary text-foreground">
            <Moon className="size-4" strokeWidth={2.5} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-eyebrow text-muted-foreground">Ciclo · Fase atual</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Informe a data do último início da menstruação no Perfil pra ver sua fase.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const bar: Record<string, string> = {
    menstrual: "bg-destructive",
    folicular: "bg-emerald-500",
    ovulacao: "bg-brand",
    lutea: "bg-amber-500",
  };
  const badge: Record<string, string> = {
    menstrual: "bg-destructive/15 text-destructive",
    folicular: "bg-emerald-500/15 text-emerald-500",
    ovulacao: "bg-brand/20 text-foreground",
    lutea: "bg-amber-500/15 text-amber-500",
  };

  return (
    <div className="card-lift relative mt-4 overflow-hidden p-4 sm:p-5">
      <span className={`absolute inset-y-0 left-0 w-1 ${bar[info.phase]}`} aria-hidden />
      <div className="flex items-start gap-3 pl-2">
        <span className={`grid size-9 shrink-0 place-items-center rounded-full ${badge[info.phase]}`}>
          <Moon className="size-4" strokeWidth={2.5} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="text-eyebrow text-muted-foreground">Ciclo · Fase atual</p>
            <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              dia {info.dayInCycle}/{info.cycleLength}
            </span>
          </div>
          <p className="mt-1 font-display text-base leading-snug text-foreground sm:text-lg">
            {info.headline}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">{info.recommendation}</p>
          <span className={`mt-2 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${badge[info.phase]}`}>
            {info.phaseLabel}
            {info.isLatePhaseLutea ? " · TPM" : ""}
          </span>
        </div>
      </div>
    </div>
  );
}


