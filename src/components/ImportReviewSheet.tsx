import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Trash2, Loader2, Dumbbell, Activity } from "lucide-react";
import { toast } from "sonner";
import type { ImportedSession, ImportedWorkoutsResponse } from "@/lib/import-schema";
import { translateActivityType } from "@/lib/workout-file-parser";

type Props = {
  userId: string;
  parsed: ImportedWorkoutsResponse;
  importSource: string; // "photo" | "pdf:name.pdf" | "text"
  onSaved: () => void;
  onCancel: () => void;
};

type Draft = ImportedSession & { _include: boolean; _id: string };

function toIsoOrNull(date: string | null, time: string | null): string | null {
  if (!date) return null;
  const t = time && /^\d{1,2}:\d{2}$/.test(time) ? time : "12:00";
  const d = new Date(`${date}T${t}:00`);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

export function ImportReviewSheet({ userId, parsed, importSource, onSaved, onCancel }: Props) {
  const qc = useQueryClient();
  const [drafts, setDrafts] = useState<Draft[]>(() =>
    parsed.sessions.map((s, i) => ({ ...s, _include: true, _id: `s${i}` })),
  );

  // Datas dos rascunhos que têm data, para checar duplicatas com ±5min.
  const draftDates = useMemo(
    () => drafts.map((d) => toIsoOrNull(d.date, d.time)).filter((v): v is string => !!v),
    [drafts],
  );

  const { data: existing = [] } = useQuery({
    enabled: draftDates.length > 0,
    queryKey: ["import-dup-check", userId, draftDates.slice().sort()],
    queryFn: async () => {
      const min = new Date(Math.min(...draftDates.map((d) => new Date(d).getTime())) - 5 * 60_000);
      const max = new Date(Math.max(...draftDates.map((d) => new Date(d).getTime())) + 5 * 60_000);
      const { data } = await supabase
        .from("sessions")
        .select("started_at,activity_type")
        .eq("user_id", userId)
        .gte("started_at", min.toISOString())
        .lte("started_at", max.toISOString());
      return data ?? [];
    },
  });

  function isDuplicate(d: Draft): boolean {
    const iso = toIsoOrNull(d.date, d.time);
    if (!iso) return false;
    const t = new Date(iso).getTime();
    return existing.some((e) => Math.abs(new Date(e.started_at).getTime() - t) <= 5 * 60_000);
  }

  function updateDraft(id: string, patch: Partial<Draft>) {
    setDrafts((prev) => prev.map((d) => (d._id === id ? { ...d, ...patch } : d)));
  }

  const includedCount = drafts.filter((d) => d._include).length;

  const save = useMutation({
    mutationFn: async () => {
      const toSave = drafts.filter((d) => d._include);
      if (!toSave.length) throw new Error("Selecione ao menos um treino.");

      // Pré-carrega catálogo de exercícios (padrão + criados pelo usuário) para mapear por nome.
      const { data: catalog } = await supabase
        .from("exercises")
        .select("id, name")
        .or(`is_default.eq.true,created_by.eq.${userId}`);
      const byName = new Map<string, string>();
      (catalog ?? []).forEach((e) => byName.set(e.name.toLowerCase().trim(), e.id));

      for (const s of toSave) {
        const started = toIsoOrNull(s.date, s.time) ?? new Date().toISOString();
        const ended = s.duration_min
          ? new Date(new Date(started).getTime() + s.duration_min * 60_000).toISOString()
          : started;

        const { data: session, error } = await supabase
          .from("sessions")
          .insert({
            user_id: userId,
            started_at: started,
            ended_at: ended,
            title: s.title || null,
            activity_type: s.activity_type,
            distance_m: s.distance_m,
            avg_hr: s.avg_hr,
            max_hr: s.max_hr,
            calories: s.calories,
            elevation_gain_m: s.elevation_gain_m,
            elevation_loss_m: s.elevation_loss_m,
            notes: s.notes,
            source: importSource.startsWith("file") ? "import_file" : `import_${importSource.split(":")[0]}`,
            import_source: importSource,
          })
          .select("id")
          .single();
        if (error) throw error;

        // Se tiver exercícios → grava session_sets.
        if (s.exercises.length > 0 && session) {
          const sets: Array<{
            session_id: string;
            exercise_id: string;
            set_number: number;
            reps: number | null;
            weight_kg: number | null;
          }> = [];
          for (const ex of s.exercises) {
            const key = ex.name.toLowerCase().trim();
            let exerciseId = byName.get(key);
            if (!exerciseId) {
              const { data: created, error: exErr } = await supabase
                .from("exercises")
                .insert({ name: ex.name.trim(), muscle_group: "Outros", is_default: false, created_by: userId })
                .select("id")
                .single();
              if (exErr) throw exErr;
              exerciseId = created.id;
              byName.set(key, exerciseId);
            }
            ex.sets.forEach((set, i) => {
              sets.push({
                session_id: session.id,
                exercise_id: exerciseId!,
                set_number: i + 1,
                reps: set.reps,
                weight_kg: set.weight_kg,
              });
            });
          }
          if (sets.length) {
            const { error: setsErr } = await supabase.from("session_sets").insert(sets);
            if (setsErr) throw setsErr;
          }
        }
      }
    },
    onSuccess: () => {
      toast.success(`${includedCount} treino${includedCount > 1 ? "s" : ""} importado${includedCount > 1 ? "s" : ""}`);
      qc.invalidateQueries({ queryKey: ["history-sessions"] });
      qc.invalidateQueries({ queryKey: ["recent-sessions"] });
      qc.invalidateQueries({ queryKey: ["month-sessions"] });
      qc.invalidateQueries({ queryKey: ["recovery"] });
      onSaved();
    },
    onError: (e: any) => toast.error(e.message ?? "Falha ao salvar treinos."),
  });

  if (drafts.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-6 text-center">
        <p className="text-sm text-muted-foreground">
          Não conseguimos identificar dados de treino no conteúdo enviado. Tente outra fonte ou preencha manualmente.
        </p>
        <Button variant="outline" size="sm" className="mt-3" onClick={onCancel}>
          Voltar
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Revise, edite e desmarque o que não deseja importar. {includedCount} de {drafts.length} selecionado
        {includedCount === 1 ? "" : "s"}.
      </p>

      <div className="max-h-[52vh] space-y-3 overflow-y-auto pr-1">
        {drafts.map((d) => {
          const dup = isDuplicate(d);
          const isStrength = d.exercises.length > 0;
          return (
            <div
              key={d._id}
              className={`rounded-xl border p-3 transition-opacity ${
                d._include ? "border-border bg-card" : "border-dashed border-border bg-muted/40 opacity-60"
              }`}
            >
              <div className="flex items-start gap-2">
                <Checkbox
                  checked={d._include}
                  onCheckedChange={(v) => updateDraft(d._id, { _include: !!v })}
                  className="mt-1"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    {isStrength ? (
                      <Dumbbell className="size-4 text-primary" />
                    ) : (
                      <Activity className="size-4 text-primary" />
                    )}
                    <span className="font-semibold">
                      {d.title || translateActivityType(d.activity_type)}
                    </span>
                    {dup && <Badge variant="destructive">Duplicado</Badge>}
                  </div>

                  <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
                    <div>
                      <Label className="text-[11px]">Data</Label>
                      <Input
                        type="date"
                        value={d.date ?? ""}
                        onChange={(e) => updateDraft(d._id, { date: e.target.value || null })}
                        className="h-8"
                      />
                    </div>
                    <div>
                      <Label className="text-[11px]">Hora</Label>
                      <Input
                        type="time"
                        value={d.time ?? ""}
                        onChange={(e) => updateDraft(d._id, { time: e.target.value || null })}
                        className="h-8"
                      />
                    </div>
                    <div>
                      <Label className="text-[11px]">Duração (min)</Label>
                      <Input
                        type="number"
                        min={0}
                        value={d.duration_min ?? ""}
                        onChange={(e) =>
                          updateDraft(d._id, {
                            duration_min: e.target.value ? Number(e.target.value) : null,
                          })
                        }
                        className="h-8"
                      />
                    </div>
                    {!isStrength && (
                      <>
                        <div>
                          <Label className="text-[11px]">Distância (m)</Label>
                          <Input
                            type="number"
                            min={0}
                            value={d.distance_m ?? ""}
                            onChange={(e) =>
                              updateDraft(d._id, {
                                distance_m: e.target.value ? Number(e.target.value) : null,
                              })
                            }
                            className="h-8"
                          />
                        </div>
                        <div>
                          <Label className="text-[11px]">FC média</Label>
                          <Input
                            type="number"
                            min={0}
                            value={d.avg_hr ?? ""}
                            onChange={(e) =>
                              updateDraft(d._id, {
                                avg_hr: e.target.value ? Number(e.target.value) : null,
                              })
                            }
                            className="h-8"
                          />
                        </div>
                        <div>
                          <Label className="text-[11px]">Calorias</Label>
                          <Input
                            type="number"
                            min={0}
                            value={d.calories ?? ""}
                            onChange={(e) =>
                              updateDraft(d._id, {
                                calories: e.target.value ? Number(e.target.value) : null,
                              })
                            }
                            className="h-8"
                          />
                        </div>
                      </>
                    )}
                  </div>

                  {isStrength && (
                    <div className="mt-2 space-y-1 rounded-lg bg-secondary/40 p-2 text-xs">
                      {d.exercises.map((ex, i) => (
                        <div key={i} className="flex items-center justify-between gap-2">
                          <span className="truncate font-medium">{ex.name}</span>
                          <span className="whitespace-nowrap text-muted-foreground">
                            {ex.sets.length}x{" "}
                            {ex.sets
                              .map((s) => `${s.reps ?? "?"}${s.weight_kg ? `@${s.weight_kg}kg` : ""}`)
                              .join(" / ")}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <button
                  onClick={() => setDrafts((prev) => prev.filter((x) => x._id !== d._id))}
                  className="grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-destructive"
                  title="Remover"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex justify-end gap-2 pt-1">
        <Button variant="outline" onClick={onCancel} disabled={save.isPending}>
          Cancelar
        </Button>
        <Button onClick={() => save.mutate()} disabled={save.isPending || includedCount === 0}>
          {save.isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            `Salvar ${includedCount} treino${includedCount === 1 ? "" : "s"}`
          )}
        </Button>
      </div>
    </div>
  );
}
