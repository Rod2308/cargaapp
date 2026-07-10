import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Route as AuthedRoute } from "./route";
import { Button } from "@/components/ui/button";
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
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar as CalendarIcon, Pencil, Trash2, Play, Upload } from "lucide-react";
import { toast } from "sonner";
import { sessionTitle, sessionSubtitle } from "@/lib/session-display";
import { ImportWorkoutDialog } from "@/components/ImportWorkoutDialog";

export const Route = createFileRoute("/_authenticated/app/historico")({
  component: HistoryPage,
});

function HistoryPage() {
  const { user } = AuthedRoute.useRouteContext();
  const qc = useQueryClient();
  const navigate = useNavigate();

  const { data: sessions = [], isLoading } = useQuery({
    queryKey: ["history-sessions", user.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("sessions")
        .select("id, started_at, ended_at, perceived_effort, notes, workout_id, workouts(name, label), session_sets(id, reps, weight_kg, exercises(name, muscle_group))")
        .eq("user_id", user.id)
        .order("started_at", { ascending: false });
      return data ?? [];
    },
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("sessions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Treino excluído");
      qc.invalidateQueries({ queryKey: ["history-sessions"] });
      qc.invalidateQueries({ queryKey: ["recent-sessions"] });
      qc.invalidateQueries({ queryKey: ["month-sessions"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Agrupar por mês
  const grouped: Record<string, typeof sessions> = {};
  for (const s of sessions) {
    const key = format(new Date(s.started_at), "MMMM 'de' yyyy", { locale: ptBR });
    (grouped[key] ??= []).push(s);
  }

  return (
    <div className="app-container pt-8 sm:pt-12">
      <header>
        <p className="text-eyebrow text-muted-foreground">Registros</p>
        <h1 className="mt-2 font-display text-3xl tracking-tight">Histórico</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Todos os treinos que você realizou. Edite carga, reps ou exclua sessões antigas.
        </p>
      </header>

      {isLoading ? (
        <p className="mt-8 text-sm text-muted-foreground">Carregando...</p>
      ) : sessions.length === 0 ? (
        <div className="card-lift mt-8 p-6 text-center text-sm text-muted-foreground">
          Nenhum treino registrado ainda.
        </div>
      ) : (
        <div className="mt-6 space-y-8">
          {Object.entries(grouped).map(([month, list]) => (
            <section key={month}>
              <h2 className="mb-3 text-eyebrow text-muted-foreground first-letter:uppercase">{month}</h2>
              <ul className="space-y-2">
                {list.map((s: any) => {
                  const done = !!s.ended_at;
                  const setsCount = s.session_sets?.length ?? 0;
                  const subtitle = sessionSubtitle(s);
                  return (
                    <li key={s.id} className="card-lift flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <p className="truncate font-display text-sm font-bold">
                          {sessionTitle(s)}
                        </p>
                        <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                          <CalendarIcon className="size-3" />
                          {format(new Date(s.started_at), "d MMM yyyy · HH:mm", { locale: ptBR })}
                          {subtitle ? <><span>·</span><span>{subtitle}</span></> : (setsCount > 0 && <><span>·</span><span>{setsCount} série{setsCount === 1 ? "" : "s"}</span></>)}
                          {s.perceived_effort && <><span>·</span><span>RPE {s.perceived_effort}</span></>}
                          {s.notes && <><span>·</span><span className="truncate">{s.notes}</span></>}
                          {!done && (
                            <span className="ml-1 rounded-full bg-brand/25 px-2 py-0.5 font-semibold text-foreground">
                              em andamento
                            </span>
                          )}
                        </p>
                      </div>
                      <div className="flex shrink-0 gap-2">
                        {!done ? (
                          <Button size="sm" onClick={() => navigate({ to: "/app/sessao/$id", params: { id: s.id } })}>
                            <Play className="size-3.5 fill-current" /> Continuar
                          </Button>
                        ) : (
                          <Button size="sm" variant="outline" onClick={() => navigate({ to: "/app/sessao/$id/editar", params: { id: s.id } })}>
                            <Pencil className="size-3.5" /> Editar
                          </Button>
                        )}
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button size="sm" variant="outline" className="text-destructive hover:text-destructive">
                              <Trash2 className="size-3.5" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Excluir este treino?</AlertDialogTitle>
                              <AlertDialogDescription>
                                A sessão e todas as séries registradas serão removidas. Esta ação não pode ser desfeita.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction onClick={() => del.mutate(s.id)}>Excluir</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}

      <div className="mt-8 text-center">
        <Link to="/app" className="text-xs font-semibold underline underline-offset-4">Voltar ao início</Link>
      </div>
    </div>
  );
}
