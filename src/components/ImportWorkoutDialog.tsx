import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, Loader2, FileUp, X } from "lucide-react";
import { toast } from "sonner";
import { useOnline } from "@/hooks/useOnline";
import { OfflineNotice } from "@/components/OfflineNotice";
import {
  parseWorkoutFile,
  translateActivityType,
  type ParsedWorkout,
} from "@/lib/workout-file-parser";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const MAX_FILE_MB = 10;
const MAX_FILES = 20;

function toLocalDateInput(iso: string): string {
  const d = new Date(iso);
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 10);
}

function applyDateToIso(iso: string, dateStr: string): string {
  const original = new Date(iso);
  const [y, m, day] = dateStr.split("-").map(Number);
  const updated = new Date(original);
  updated.setFullYear(y, m - 1, day);
  return updated.toISOString();
}

function formatDuration(startIso: string, endIso: string): string {
  const seconds = Math.max(0, Math.round((new Date(endIso).getTime() - new Date(startIso).getTime()) / 1000));
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h${String(m).padStart(2, "0")}min`;
  if (m > 0) return `${m}min`;
  return `${seconds}s`;
}

type PendingItem = {
  id: string;
  fileName: string;
  parsed: ParsedWorkout;
  dateStr: string;
  workoutId: string;
};

export function ImportWorkoutDialog({ userId, onImported }: { userId: string; onImported?: () => void }) {
  const qc = useQueryClient();
  const online = useOnline();
  const [open, setOpen] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [items, setItems] = useState<PendingItem[]>([]);
  const [dragging, setDragging] = useState(false);
  const [parseErrors, setParseErrors] = useState<string[]>([]);

  const { data: workouts = [] } = useQuery({
    enabled: open,
    queryKey: ["user-workouts-picker", userId],
    queryFn: async () => {
      const { data } = await supabase
        .from("workouts")
        .select("id, label, name")
        .eq("user_id", userId)
        .order("order_idx", { ascending: true });
      return data ?? [];
    },
  });

  function reset() {
    setItems([]);
    setDragging(false);
    setParsing(false);
    setParseErrors([]);
  }

  async function handleFiles(files: File[]) {
    if (!files.length) return;
    const slots = Math.max(0, MAX_FILES - items.length);
    const batch = files.slice(0, slots);
    if (files.length > slots) toast.warning(`Limite de ${MAX_FILES} arquivos por importação`);
    setParsing(true);
    const errors: string[] = [];
    const parsedItems: PendingItem[] = [];
    for (const file of batch) {
      if (file.size > MAX_FILE_MB * 1024 * 1024) {
        errors.push(`${file.name}: maior que ${MAX_FILE_MB}MB`);
        continue;
      }
      try {
        const result = await parseWorkoutFile(file);
        parsedItems.push({
          id: `${file.name}-${Math.random().toString(36).slice(2, 8)}`,
          fileName: file.name,
          parsed: result,
          dateStr: toLocalDateInput(result.started_at),
          workoutId: "none",
        });
      } catch (e: any) {
        errors.push(`${file.name}: ${e.message ?? "não foi possível ler"}`);
      }
    }
    setItems((cur) => [...cur, ...parsedItems]);
    setParseErrors(errors);
    setParsing(false);
    if (errors.length) toast.error(`${errors.length} arquivo(s) com erro`);
  }

  function updateItem(id: string, patch: Partial<PendingItem>) {
    setItems((cur) => cur.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  }

  function removeItem(id: string) {
    setItems((cur) => cur.filter((it) => it.id !== id));
  }

  function shiftDatesBackwards() {
    // Assign consecutive dates ending today for items lacking uniqueness
    setItems((cur) => {
      const today = new Date();
      return cur.map((it, idx) => {
        const d = new Date(today);
        d.setDate(today.getDate() - (cur.length - 1 - idx));
        return { ...it, dateStr: toLocalDateInput(d.toISOString()) };
      });
    });
    toast.success("Datas distribuídas: uma por dia até hoje");
  }

  const save = useMutation({
    mutationFn: async () => {
      if (!items.length) throw new Error("Nada para importar");
      const rows = items.map((it) => {
        const cleanName = it.fileName.replace(/\.[^.]+$/, "").trim().slice(0, 80) || null;
        return {
          user_id: userId,
          workout_id: it.workoutId === "none" ? null : it.workoutId,
          started_at: applyDateToIso(it.parsed.started_at, it.dateStr),
          ended_at: applyDateToIso(it.parsed.ended_at, it.dateStr),
          activity_type: it.parsed.activity_type,
          distance_m: it.parsed.distance_m,
          avg_hr: it.parsed.avg_hr,
          max_hr: it.parsed.max_hr,
          calories: it.parsed.calories,
          source: it.parsed.source,
          title: cleanName,
        };
      });
      const { error } = await supabase.from("sessions").insert(rows);
      if (error) throw error;
      return rows.length;
    },
    onSuccess: (count) => {
      toast.success(count === 1 ? "Treino importado" : `${count} treinos importados`);
      qc.invalidateQueries({ queryKey: ["history-sessions"] });
      qc.invalidateQueries({ queryKey: ["recent-sessions"] });
      qc.invalidateQueries({ queryKey: ["month-sessions"] });
      qc.invalidateQueries({ queryKey: ["workout-recent-cardio"] });
      qc.invalidateQueries({ queryKey: ["recovery"] });
      onImported?.();
      setOpen(false);
      reset();
    },
    onError: (e: any) => toast.error(e.message ?? "Falha ao salvar"),
  });

  const todayStr = toLocalDateInput(new Date().toISOString());

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" disabled={!online} title={!online ? "Requer internet" : undefined}>
          <Upload className="size-3.5" /> Importar treino
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Importar treinos</DialogTitle>
          <DialogDescription>
            Envie um ou vários arquivos <strong>.fit</strong>, <strong>.gpx</strong> ou{" "}
            <strong>.tcx</strong>. Você pode ajustar a data de cada treino antes de salvar.
          </DialogDescription>
        </DialogHeader>
        <OfflineNotice feature="Importação de treino" />

        <label
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            const fs = Array.from(e.dataTransfer.files ?? []);
            if (fs.length) void handleFiles(fs);
          }}
          className={`flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed p-6 text-center transition-colors ${
            dragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
          }`}
        >
          {parsing ? (
            <Loader2 className="size-6 animate-spin text-primary" />
          ) : (
            <FileUp className="size-6 text-muted-foreground" />
          )}
          <p className="text-sm font-medium">
            {parsing ? "Lendo arquivos..." : "Toque para escolher ou arraste vários aqui"}
          </p>
          <p className="text-xs text-muted-foreground">
            .fit, .gpx, .tcx · até {MAX_FILE_MB}MB cada · máx. {MAX_FILES} por vez
          </p>
          <input
            type="file"
            multiple
            accept=".fit,.gpx,.tcx"
            className="hidden"
            onChange={(e) => {
              const fs = Array.from(e.target.files ?? []);
              if (fs.length) void handleFiles(fs);
              e.target.value = "";
            }}
          />
        </label>

        {parseErrors.length > 0 && (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-xs">
            <p className="font-semibold text-destructive">Erros de leitura:</p>
            <ul className="mt-1 list-disc pl-4 text-destructive/90">
              {parseErrors.map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          </div>
        )}

        {items.length > 0 && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-semibold">
                {items.length} treino{items.length > 1 ? "s" : ""} pronto{items.length > 1 ? "s" : ""} para
                importar
              </p>
              {items.length > 1 && (
                <Button size="sm" variant="ghost" onClick={shiftDatesBackwards} className="h-7 text-xs">
                  Distribuir: 1 por dia até hoje
                </Button>
              )}
            </div>

            <div className="space-y-2">
              {items.map((it) => (
                <div key={it.id} className="rounded-xl border border-border bg-card p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">
                        {translateActivityType(it.parsed.activity_type)}
                      </p>
                      <p className="truncate text-[11px] text-muted-foreground">{it.fileName}</p>
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        Original:{" "}
                        {format(new Date(it.parsed.started_at), "d MMM yyyy · HH:mm", { locale: ptBR })} ·
                        Duração: {formatDuration(it.parsed.started_at, it.parsed.ended_at)}
                        {it.parsed.distance_m ? ` · ${(it.parsed.distance_m / 1000).toFixed(2)} km` : ""}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7"
                      onClick={() => removeItem(it.id)}
                      title="Remover"
                    >
                      <X className="size-4" />
                    </Button>
                  </div>

                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    <div>
                      <label className="text-[11px] font-semibold text-muted-foreground">
                        Data do treino
                      </label>
                      <input
                        type="date"
                        value={it.dateStr}
                        max={todayStr}
                        onChange={(e) => updateItem(it.id, { dateStr: e.target.value })}
                        className="mt-0.5 w-full rounded-lg border border-border bg-background p-1.5 text-sm outline-none focus:border-primary"
                      />
                    </div>
                    {workouts.length > 0 && (
                      <div>
                        <label className="text-[11px] font-semibold text-muted-foreground">
                          Vincular ao plano
                        </label>
                        <Select
                          value={it.workoutId}
                          onValueChange={(v) => updateItem(it.id, { workoutId: v })}
                        >
                          <SelectTrigger className="mt-0.5 h-8">
                            <SelectValue placeholder="Sem vínculo" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Sem vínculo</SelectItem>
                            {workouts.map((w) => (
                              <SelectItem key={w.id} value={w.id}>
                                {w.label ? `${w.label} — ` : ""}
                                {w.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={save.isPending}>
            Cancelar
          </Button>
          <Button onClick={() => save.mutate()} disabled={!items.length || save.isPending}>
            {save.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : items.length > 1 ? (
              `Salvar ${items.length} treinos`
            ) : (
              "Salvar no histórico"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
