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
import { Upload, Loader2, FileUp, Activity, Heart, Flame, Ruler, Timer, Link as LinkIcon } from "lucide-react";
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

function formatDuration(startIso: string, endIso: string): string {
  const seconds = Math.max(0, Math.round((new Date(endIso).getTime() - new Date(startIso).getTime()) / 1000));
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h${String(m).padStart(2, "0")}min`;
  if (m > 0) return `${m}min ${String(s).padStart(2, "0")}s`;
  return `${s}s`;
}

function formatDistance(m: number): string {
  if (m >= 1000) return `${(m / 1000).toFixed(2).replace(".", ",")} km`;
  return `${m} m`;
}

export function ImportWorkoutDialog({ userId, onImported }: { userId: string; onImported?: () => void }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [parsed, setParsed] = useState<ParsedWorkout | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [dragging, setDragging] = useState(false);
  const [workoutId, setWorkoutId] = useState<string>("none");

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
    setParsed(null);
    setFileName(null);
    setNotes("");
    setDragging(false);
    setParsing(false);
    setWorkoutId("none");
  }

  async function handleFile(file: File) {
    if (file.size > MAX_FILE_MB * 1024 * 1024) {
      toast.error(`Arquivo maior que ${MAX_FILE_MB}MB`);
      return;
    }
    setParsing(true);
    setFileName(file.name);
    try {
      const result = await parseWorkoutFile(file);
      setParsed(result);
    } catch (e: any) {
      toast.error(e.message ?? "Não foi possível ler o arquivo");
      setFileName(null);
    } finally {
      setParsing(false);
    }
  }

  const save = useMutation({
    mutationFn: async () => {
      if (!parsed) throw new Error("Nada para salvar");
      const { error } = await supabase.from("sessions").insert({
        user_id: userId,
        workout_id: workoutId === "none" ? null : workoutId,
        started_at: parsed.started_at,
        ended_at: parsed.ended_at,
        activity_type: parsed.activity_type,
        distance_m: parsed.distance_m,
        avg_hr: parsed.avg_hr,
        max_hr: parsed.max_hr,
        calories: parsed.calories,
        source: parsed.source,
        notes: notes.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Treino importado");
      qc.invalidateQueries({ queryKey: ["history-sessions"] });
      qc.invalidateQueries({ queryKey: ["recent-sessions"] });
      qc.invalidateQueries({ queryKey: ["month-sessions"] });
      qc.invalidateQueries({ queryKey: ["workout-recent-cardio"] });
      onImported?.();
      setOpen(false);
      reset();
    },
    onError: (e: any) => toast.error(e.message ?? "Falha ao salvar"),
  });

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
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Importar treino</DialogTitle>
          <DialogDescription>
            Envie um arquivo <strong>.fit</strong>, <strong>.gpx</strong> ou <strong>.tcx</strong> exportado
            do seu relógio, Strava, Garmin, Polar, Coros, Suunto etc.
          </DialogDescription>
        </DialogHeader>
        <OfflineNotice feature="Importação de treino" />


        {!parsed && !parsing && (
          <label
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              const f = e.dataTransfer.files?.[0];
              if (f) void handleFile(f);
            }}
            className={`flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed p-8 text-center transition-colors ${
              dragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
            }`}
          >
            <FileUp className="size-8 text-muted-foreground" />
            <p className="text-sm font-medium">Toque para escolher ou arraste aqui</p>
            <p className="text-xs text-muted-foreground">.fit, .gpx, .tcx · até {MAX_FILE_MB}MB</p>
            <input
              type="file"
              accept=".fit,.gpx,.tcx"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleFile(f);
              }}
            />
          </label>
        )}

        {parsing && (
          <div className="flex flex-col items-center gap-2 py-8">
            <Loader2 className="size-6 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Lendo {fileName}...</p>
          </div>
        )}

        {parsed && (
          <div className="space-y-4">
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-eyebrow text-muted-foreground">Prévia</p>
              <p className="mt-1 font-display text-lg">{translateActivityType(parsed.activity_type)}</p>
              <p className="text-xs text-muted-foreground">
                {format(new Date(parsed.started_at), "d MMM yyyy · HH:mm", { locale: ptBR })}
              </p>

              <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                <Stat icon={Timer} label="Duração" value={formatDuration(parsed.started_at, parsed.ended_at)} />
                {parsed.distance_m != null && (
                  <Stat icon={Ruler} label="Distância" value={formatDistance(parsed.distance_m)} />
                )}
                {parsed.avg_hr != null && (
                  <Stat icon={Heart} label="FC média" value={`${parsed.avg_hr} bpm`} />
                )}
                {parsed.max_hr != null && (
                  <Stat icon={Activity} label="FC máx" value={`${parsed.max_hr} bpm`} />
                )}
                {parsed.calories != null && (
                  <Stat icon={Flame} label="Calorias" value={`${parsed.calories} kcal`} />
                )}
              </div>
              {fileName && <p className="mt-3 truncate text-[11px] text-muted-foreground">Arquivo: {fileName}</p>}
            </div>

            {workouts.length > 0 && (
              <div>
                <label className="flex items-center gap-1.5 text-sm font-semibold">
                  <LinkIcon className="size-3.5" /> Vincular ao plano (opcional)
                </label>
                <Select value={workoutId} onValueChange={setWorkoutId}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Escolha um dia do plano" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sem vínculo</SelectItem>
                    {workouts.map((w) => (
                      <SelectItem key={w.id} value={w.id}>
                        {w.label ? `Treino ${w.label} — ` : ""}{w.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Vincular faz o Carga usar FC e volume para ajustar carga e descanso do plano.
                </p>
              </div>
            )}

            <div>
              <label className="text-sm font-semibold">Observações (opcional)</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                maxLength={500}
                rows={2}
                placeholder="Como foi o treino?"
                className="mt-1 w-full resize-none rounded-lg border border-border bg-card p-2 text-sm outline-none focus:border-primary"
              />
            </div>

            <button
              type="button"
              onClick={reset}
              className="text-xs font-semibold text-muted-foreground underline underline-offset-4"
            >
              Escolher outro arquivo
            </button>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={save.isPending}>
            Cancelar
          </Button>
          <Button onClick={() => save.mutate()} disabled={!parsed || save.isPending}>
            {save.isPending ? <Loader2 className="size-4 animate-spin" /> : "Salvar no histórico"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Stat({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg bg-secondary/50 px-2 py-1.5">
      <Icon className="size-3.5 shrink-0 text-muted-foreground" />
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="truncate text-sm font-semibold">{value}</p>
      </div>
    </div>
  );
}
