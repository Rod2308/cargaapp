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
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar as CalendarIcon, Pencil, Trash2, Play, Upload, Type } from "lucide-react";
import { toast } from "sonner";
import { sessionTitle, sessionSubtitle } from "@/lib/session-display";
import { ImportWorkoutDialog } from "@/components/ImportWorkoutDialog";
import { LinkToWorkoutButton } from "@/components/LinkToWorkoutButton";
import { RetroWorkoutDialog } from "@/components/RetroWorkoutDialog";

export const Route = createFileRoute("/_authenticated/app/historico")({
  component: HistoryPage,
});


function HistoryPage() {
  const { user } = AuthedRoute.useRouteContext();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [renaming, setRenaming] = useState<{ id: string; current: string } | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const { data: sessions = [], isLoading } = useQuery({
    queryKey: ["history-sessions", user.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("sessions")
        .select("id, started_at, ended_at, perceived_effort, notes, title, workout_id, source, activity_type, distance_m, avg_hr, max_hr, calories, workouts(name, label), session_sets(id, reps, weight_kg, exercises(name, muscle_group))")
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

  const rename = useMutation({
    mutationFn: async ({ id, title }: { id: string; title: string | null }) => {
      const { error } = await supabase.from("sessions").update({ title }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Nome atualizado");
      setRenaming(null);
      qc.invalidateQueries({ queryKey: ["history-sessions"] });
      qc.invalidateQueries({ queryKey: ["recent-sessions"] });
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
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-eyebrow text-muted-foreground">Registros</p>
          <h1 className="mt-2 font-display text-3xl tracking-tight">Histórico</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Todos os treinos que você realizou. Edite carga, reps ou exclua sessões antigas.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <RetroWorkoutDialog userId={user.id} triggerLabel="Marcar treino esquecido" />
          <ImportWorkoutDialog userId={user.id} />
        </div>
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
                  const imported = s.source && s.source !== "manual";

                  const durationSec = s.started_at && s.ended_at
                    ? Math.max(0, Math.round((new Date(s.ended_at).getTime() - new Date(s.started_at).getTime()) / 1000))
                    : 0;
                  const fmtDuration = (sec: number) => {
                    if (!sec) return null;
                    const h = Math.floor(sec / 3600);
                    const m = Math.floor((sec % 3600) / 60);
                    const ss = sec % 60;
                    if (h > 0) return `${h}h${String(m).padStart(2, "0")}`;
                    if (m > 0) return `${m}min${ss ? ` ${ss}s` : ""}`;
                    return `${ss}s`;
                  };
                  const fmtDistance = (m: number) => m >= 1000
                    ? `${(m / 1000).toFixed(2).replace(".", ",")} km`
                    : `${m} m`;
                  const pace = imported && s.distance_m && durationSec > 0 && s.distance_m >= 400
                    ? (() => {
                        const paceSec = durationSec / (s.distance_m / 1000);
                        const pm = Math.floor(paceSec / 60);
                        const ps = Math.round(paceSec % 60);
                        return `${pm}:${String(ps).padStart(2, "0")} /km`;
                      })()
                    : null;

                  const metrics: { label: string; value: string }[] = [];
                  if (imported) {
                    if (s.distance_m) metrics.push({ label: "Distância", value: fmtDistance(s.distance_m) });
                    const dur = fmtDuration(durationSec);
                    if (dur) metrics.push({ label: "Duração", value: dur });
                    if (pace) metrics.push({ label: "Pace", value: pace });
                    if (s.avg_hr) metrics.push({ label: "FC média", value: `${s.avg_hr} bpm` });
                    if (s.max_hr) metrics.push({ label: "FC máx", value: `${s.max_hr} bpm` });
                    if (s.calories) metrics.push({ label: "Calorias", value: `${s.calories} kcal` });
                    if (s.perceived_effort) metrics.push({ label: "RPE", value: `${s.perceived_effort}/10` });
                  }

                  return (
                    <li key={s.id} className="card-lift flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0 flex-1">
                        <p className="flex items-center gap-2 truncate font-display text-sm font-bold">
                          {sessionTitle(s)}
                          {imported && (
                            <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                              Importado
                            </span>
                          )}
                        </p>
                        <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                          <CalendarIcon className="size-3" />
                          {format(new Date(s.started_at), "d MMM yyyy · HH:mm", { locale: ptBR })}
                          {!imported && subtitle && <><span>·</span><span>{subtitle}</span></>}
                          {!imported && !subtitle && setsCount > 0 && <><span>·</span><span>{setsCount} série{setsCount === 1 ? "" : "s"}</span></>}
                          {!imported && s.avg_hr && <><span>·</span><span>FC {s.avg_hr}</span></>}
                          {!imported && s.calories && <><span>·</span><span>{s.calories} kcal</span></>}
                          {!imported && s.perceived_effort && <><span>·</span><span>RPE {s.perceived_effort}</span></>}
                          {s.notes && <><span>·</span><span className="truncate">{s.notes}</span></>}
                          {!done && (
                            <span className="ml-1 rounded-full bg-brand/25 px-2 py-0.5 font-semibold text-foreground">
                              em andamento
                            </span>
                          )}
                        </p>
                        {imported && metrics.length > 0 && (
                          <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 sm:grid-cols-3 md:grid-cols-4">
                            {metrics.map((m) => (
                              <div key={m.label} className="rounded-lg bg-secondary/40 px-2.5 py-1.5">
                                <dt className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{m.label}</dt>
                                <dd className="mt-0.5 text-sm font-semibold tabular-nums">{m.value}</dd>
                              </div>
                            ))}
                          </dl>
                        )}
                      </div>

                      <div className="flex shrink-0 flex-wrap gap-2">
                        {done && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setRenameValue(s.title ?? sessionTitle(s));
                              setRenaming({ id: s.id, current: sessionTitle(s) });
                            }}
                            title="Renomear treino"
                          >
                            <Type className="size-3.5" /> Nome
                          </Button>
                        )}
                        {imported && done && (
                          <LinkToWorkoutButton
                            sessionId={s.id}
                            userId={user.id}
                            currentWorkoutId={s.workout_id ?? null}
                            currentWorkoutLabel={s.workouts?.label ?? s.workouts?.name ?? null}
                          />
                        )}

                        {!done ? (
                          <Button size="sm" onClick={() => navigate({ to: "/app/sessao/$id", params: { id: s.id } })}>
                            <Play className="size-3.5 fill-current" /> Continuar
                          </Button>
                        ) : !imported ? (
                          <Button size="sm" variant="outline" onClick={() => navigate({ to: "/app/sessao/$id/editar", params: { id: s.id } })}>
                            <Pencil className="size-3.5" /> Editar
                          </Button>
                        ) : null}
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

      <Dialog open={!!renaming} onOpenChange={(o) => !o && setRenaming(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Renomear treino</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="session-title">Nome do treino</Label>
            <Input
              id="session-title"
              value={renameValue}
              maxLength={80}
              placeholder={renaming?.current ?? ""}
              onChange={(e) => setRenameValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && renaming) {
                  const v = renameValue.trim();
                  rename.mutate({ id: renaming.id, title: v ? v.slice(0, 80) : null });
                }
              }}
              autoFocus
            />
            <p className="text-xs text-muted-foreground">
              Deixe em branco para usar o nome padrão.
            </p>
          </div>
          <DialogFooter className="gap-2">
            {renaming && (
              <Button
                variant="outline"
                onClick={() => rename.mutate({ id: renaming.id, title: null })}
                disabled={rename.isPending}
              >
                Restaurar padrão
              </Button>
            )}
            <Button
              onClick={() => {
                if (!renaming) return;
                const v = renameValue.trim();
                rename.mutate({ id: renaming.id, title: v ? v.slice(0, 80) : null });
              }}
              disabled={rename.isPending}
            >
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
