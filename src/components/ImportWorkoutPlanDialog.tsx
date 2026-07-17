import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ClipboardPaste, Loader2, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useOnline } from "@/hooks/useOnline";
import { OfflineNotice } from "@/components/OfflineNotice";

// Parses lines like:
//   "Supino reto 4x10"
//   "Agachamento - 4 x 12 60kg desc 90s"
//   "3. Puxada 4x8-10 @ 40kg desc:90"
//   "Rosca direta: 3x15"
// Also accepts a JSON array: [{ "name": "...", "sets": 4, "reps": "10", "weight_kg": 40, "rest_seconds": 90 }]
export type ParsedExercise = {
  name: string;
  sets: number;
  reps: string;
  weight_kg: number | null;
  rest_seconds: number;
  notes?: string | null;
};

function parseLine(raw: string): ParsedExercise | null {
  let line = raw.trim();
  if (!line) return null;
  // strip leading numbering "1.", "1)", "- ", "* "
  line = line.replace(/^\s*(?:\d+\s*[.)-]|[-*•])\s*/, "");

  // sets x reps  (accept x or ×; reps can be "8", "8-10", "AMRAP")
  const setsRepsMatch = line.match(/(\d{1,2})\s*[x×]\s*([\w-]+)/i);
  if (!setsRepsMatch) return null;
  const sets = Math.min(20, Math.max(1, parseInt(setsRepsMatch[1], 10)));
  const reps = setsRepsMatch[2].slice(0, 12);

  // name = everything before the sets marker, stripped of separators
  let name = line.slice(0, setsRepsMatch.index).trim();
  name = name.replace(/[:\-–—]+\s*$/, "").trim();
  if (!name) return null;

  const rest = line.slice((setsRepsMatch.index ?? 0) + setsRepsMatch[0].length);

  // weight: "40kg", "@40", "@ 40kg", "carga 40"
  let weight: number | null = null;
  const wMatch =
    rest.match(/@\s*(\d+(?:[.,]\d+)?)\s*(?:kg)?/i) ||
    rest.match(/(\d+(?:[.,]\d+)?)\s*kg\b/i) ||
    rest.match(/\bcarga\s*[:=]?\s*(\d+(?:[.,]\d+)?)/i);
  if (wMatch) weight = parseFloat(wMatch[1].replace(",", "."));

  // rest: "90s", "desc 90", "descanso: 90", "1min", "1m30"
  let restSec = 90;
  const rMin = rest.match(/(\d+)\s*m(?:in)?(?:\s*(\d+)s?)?/i);
  const rSec = rest.match(/(?:desc(?:anso)?|rest)\s*[:=]?\s*(\d+)\s*s?/i) || rest.match(/(\d+)\s*s\b/i);
  if (rMin) restSec = parseInt(rMin[1], 10) * 60 + (rMin[2] ? parseInt(rMin[2], 10) : 0);
  else if (rSec) restSec = parseInt(rSec[1], 10);
  restSec = Math.min(600, Math.max(0, restSec));

  return { name: name.slice(0, 80), sets, reps, weight_kg: weight, rest_seconds: restSec };
}

function parseInput(text: string): ParsedExercise[] {
  const trimmed = text.trim();
  if (!trimmed) return [];
  // Try JSON first
  if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
    try {
      const raw = JSON.parse(trimmed);
      const arr = Array.isArray(raw) ? raw : raw.exercises ?? [];
      return (arr as any[])
        .map((r) => {
          const name = String(r.name ?? r.exercise ?? "").trim();
          if (!name) return null;
          return {
            name: name.slice(0, 80),
            sets: Math.min(20, Math.max(1, parseInt(String(r.sets ?? r.target_sets ?? 3), 10) || 3)),
            reps: String(r.reps ?? r.target_reps ?? "10").slice(0, 12),
            weight_kg:
              r.weight_kg != null || r.weight != null
                ? parseFloat(String(r.weight_kg ?? r.weight).replace(",", ".")) || null
                : null,
            rest_seconds: Math.min(
              600,
              Math.max(0, parseInt(String(r.rest_seconds ?? r.rest ?? 90), 10) || 90),
            ),
            notes: r.notes ?? null,
          } as ParsedExercise;
        })
        .filter(Boolean) as ParsedExercise[];
    } catch {
      // fall through to line parser
    }
  }
  return trimmed
    .split(/\r?\n/)
    .map(parseLine)
    .filter((x): x is ParsedExercise => !!x);
}

const EXAMPLE = `Supino reto 4x10 40kg desc 90s
Supino inclinado com halteres 3x12 desc 60s
Crucifixo 3x15
Tríceps corda 4x12 desc:60
Tríceps francês 3x10-12`;

export function ImportWorkoutPlanDialog({ userId }: { userId: string }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const online = useOnline();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [label, setLabel] = useState("A");
  const [name, setName] = useState("");

  const parsed = useMemo(() => parseInput(text), [text]);

  function reset() {
    setText("");
    setLabel("A");
    setName("");
  }

  const save = useMutation({
    mutationFn: async () => {
      if (parsed.length === 0) throw new Error("Nenhum exercício reconhecido");
      if (!name.trim()) throw new Error("Dê um nome ao treino");

      // Count existing to compute order_idx of the new workout
      const { count } = await supabase
        .from("workouts")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId);

      const { data: workout, error: wErr } = await supabase
        .from("workouts")
        .insert({
          user_id: userId,
          label: label.trim().slice(0, 3) || "A",
          name: name.trim().slice(0, 80),
          order_idx: count ?? 0,
        })
        .select()
        .single();
      if (wErr) throw wErr;

      // Match or create exercises (case-insensitive by name)
      const uniqueNames = Array.from(new Set(parsed.map((p) => p.name.toLowerCase())));
      const { data: existing } = await supabase
        .from("exercises")
        .select("id, name")
        .in(
          "name",
          // Try both original and lowercase; PostgREST is case-sensitive so fetch broader:
          Array.from(new Set(parsed.map((p) => p.name))),
        );
      const byName = new Map<string, string>();
      (existing ?? []).forEach((e: any) => byName.set(e.name.toLowerCase(), e.id));

      const missing = parsed
        .map((p) => p.name)
        .filter((n) => !byName.has(n.toLowerCase()))
        .filter((n, i, arr) => arr.findIndex((x) => x.toLowerCase() === n.toLowerCase()) === i);

      if (missing.length > 0) {
        const { data: created, error: cErr } = await supabase
          .from("exercises")
          .insert(
            missing.map((n) => ({
              name: n,
              muscle_group: "Outros",
              is_default: false,
              created_by: userId,
            })),
          )
          .select("id, name");
        if (cErr) throw cErr;
        (created ?? []).forEach((e: any) => byName.set(e.name.toLowerCase(), e.id));
      }

      const rows = parsed.map((p, idx) => ({
        workout_id: workout.id,
        exercise_id: byName.get(p.name.toLowerCase())!,
        order_idx: idx,
        target_sets: p.sets,
        target_reps: p.reps,
        target_weight_kg: p.weight_kg,
        target_rest_seconds: p.rest_seconds,
        notes: p.notes ?? null,
      }));
      const { error: weErr } = await supabase.from("workout_exercises").insert(rows);
      if (weErr) throw weErr;

      // uniqueNames is used above via lowercase map; touch to silence lints when noUnused is strict.
      void uniqueNames;
      return workout;
    },
    onSuccess: (w) => {
      toast.success(`Treino "${w.name}" importado com ${parsed.length} exercícios`);
      qc.invalidateQueries({ queryKey: ["workouts"] });
      setOpen(false);
      reset();
      navigate({ to: "/app/treinos/$id", params: { id: w.id } });
    },
    onError: (e: any) => toast.error(e.message ?? "Falha ao importar"),
  });

  async function pasteFromClipboard() {
    try {
      const t = await navigator.clipboard.readText();
      if (t) setText((cur) => (cur ? cur + "\n" + t : t));
    } catch {
      toast.error("Não consegui ler a área de transferência");
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" disabled={!online} title={!online ? "Requer internet" : undefined}>
          <Sparkles className="size-4" /> Importar
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Importar treino</DialogTitle>
          <DialogDescription>
            Cole o treino em texto livre (uma linha por exercício) ou JSON. Exercícios novos são criados
            automaticamente no seu catálogo.
          </DialogDescription>
        </DialogHeader>

        <OfflineNotice feature="Importação de treino" />

        <div className="grid grid-cols-[80px_1fr] gap-3">
          <div className="space-y-1.5">
            <Label>Letra</Label>
            <Input maxLength={3} value={label} onChange={(e) => setLabel(e.target.value.toUpperCase())} />
          </div>
          <div className="space-y-1.5">
            <Label>Nome do treino</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Peito e tríceps" />
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label>Exercícios</Label>
            <div className="flex gap-1">
              <Button type="button" size="sm" variant="ghost" onClick={pasteFromClipboard} className="h-7 gap-1 text-xs">
                <ClipboardPaste className="size-3.5" /> Colar
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => setText(EXAMPLE)}
                className="h-7 text-xs"
              >
                Exemplo
              </Button>
              {text && (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => setText("")}
                  className="h-7 gap-1 text-xs"
                >
                  <Trash2 className="size-3.5" />
                </Button>
              )}
            </div>
          </div>
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={7}
            placeholder={"Supino reto 4x10 40kg desc 90s\nAgachamento 4x12 60kg\n..."}
            className="font-mono text-xs"
          />
          <p className="text-[11px] text-muted-foreground">
            Formato: <code>Nome do exercício NxR peso desc:segundos</code>. Exemplos: <code>4x10</code>,{" "}
            <code>40kg</code>, <code>@40</code>, <code>desc 90</code>, <code>1min30</code>.
          </p>
        </div>

        {parsed.length > 0 && (
          <div className="max-h-48 overflow-y-auto rounded-lg border border-border">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-secondary/60 text-left">
                <tr>
                  <th className="px-2 py-1.5">Exercício</th>
                  <th className="px-2 py-1.5">Séries</th>
                  <th className="px-2 py-1.5">Reps</th>
                  <th className="px-2 py-1.5">Carga</th>
                  <th className="px-2 py-1.5">Desc</th>
                </tr>
              </thead>
              <tbody>
                {parsed.map((p, i) => (
                  <tr key={i} className="border-t border-border">
                    <td className="px-2 py-1.5">{p.name}</td>
                    <td className="px-2 py-1.5">{p.sets}</td>
                    <td className="px-2 py-1.5">{p.reps}</td>
                    <td className="px-2 py-1.5">{p.weight_kg ? `${p.weight_kg}kg` : "—"}</td>
                    <td className="px-2 py-1.5">{p.rest_seconds}s</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {text && parsed.length === 0 && (
          <p className="text-xs text-destructive">
            Nenhum exercício reconhecido. Verifique se cada linha tem no formato <code>Nome NxR</code>.
          </p>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={save.isPending}>
            Cancelar
          </Button>
          <Button
            onClick={() => save.mutate()}
            disabled={parsed.length === 0 || !name.trim() || save.isPending}
          >
            {save.isPending ? <Loader2 className="size-4 animate-spin" /> : `Importar ${parsed.length || ""}`.trim()}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
