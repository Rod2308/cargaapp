import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ClipboardPaste, FileUp, Loader2, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useOnline } from "@/hooks/useOnline";
import { OfflineNotice } from "@/components/OfflineNotice";
import { extractTextFromFile } from "@/lib/plan-file-extractor";

export type ParsedExercise = {
  name: string;
  sets: number;
  reps: string;
  weight_kg: number | null;
  rest_seconds: number;
  notes?: string | null;
  muscle_group?: string | null;
};

export type ParsedWorkoutBlock = {
  label: string;
  name: string;
  exercises: ParsedExercise[];
};

// Aliases → canonical muscle group names used by the exercise catalog.
const MUSCLE_ALIASES: Record<string, string> = {
  peito: "Peito", peitoral: "Peito", peitorais: "Peito",
  costas: "Costas", dorsal: "Costas", dorsais: "Costas",
  ombro: "Ombros", ombros: "Ombros", deltoide: "Ombros", deltoides: "Ombros",
  "posterior de ombro": "Ombros", "posterior do ombro": "Ombros",
  triceps: "Tríceps", "tríceps": "Tríceps",
  biceps: "Bíceps", "bíceps": "Bíceps",
  antebraco: "Antebraço", "antebraço": "Antebraço",
  perna: "Pernas", pernas: "Pernas",
  quadriceps: "Pernas", "quadríceps": "Pernas",
  posterior: "Pernas", "posterior de coxa": "Pernas", "posterior da coxa": "Pernas",
  isquios: "Pernas", "ísquios": "Pernas",
  gluteo: "Glúteos", "glúteo": "Glúteos", gluteos: "Glúteos", "glúteos": "Glúteos",
  panturrilha: "Panturrilha", panturrilhas: "Panturrilha",
  abdomen: "Abdômen", "abdômen": "Abdômen",
  abdominal: "Abdômen", abdominais: "Abdômen", core: "Abdômen",
  trapezio: "Trapézio", "trapézio": "Trapézio",
  cardio: "Cardio", aerobico: "Cardio", "aeróbico": "Cardio",
};

function parseMuscleGroupHeader(raw: string): string | null {
  const key = raw.trim().toLowerCase().replace(/[:\-–—]+$/g, "").trim();
  if (!key || key.length > 30) return null;
  if (/\d/.test(key) || /[x×]/i.test(key)) return null;
  return MUSCLE_ALIASES[key] ?? null;
}

// Heuristic: given free text (block name or exercise name), guess a muscle group.
const NAME_GROUP_HINTS: Array<[RegExp, string]> = [
  [/\b(supino|crucifix|crossover|peck|voador|flex[aã]o)\b/i, "Peito"],
  [/\b(puxada|remada|barra fixa|pulldown|pull ?over|levantamento terra|deadlift)\b/i, "Costas"],
  [/\b(face ?pull)\b/i, "Ombros"],
  [/\b(desenvolvim|arnold|eleva[cç][aã]o (lateral|frontal)|militar|shoulder|shrug|encolhimento)\b/i, "Ombros"],
  [/\b(tr[ií]ceps|frances|coice|kickback|testa)\b/i, "Tríceps"],
  [/\b(b[ií]ceps|rosca|scott|martelo|curl)\b/i, "Bíceps"],
  [/\b(agachamento|leg press|cadeira extensora|hack|afundo|avan[cç]o|passada|squat|b[uú]lgaro)\b/i, "Pernas"],
  [/\b(cadeira flexora|mesa flexora|st[ií]ff|posterior|isqui|good ?morning)\b/i, "Pernas"],
  [/\b(gl[uú]teo|hip ?thrust|eleva[cç][aã]o p[eé]lvica|abdu[cç][aã]o)\b/i, "Glúteos"],
  [/\b(panturrilha|gemelar|gastroc|calf)\b/i, "Panturrilha"],
  [/\b(abdominal|abd[oô]men|prancha|plank|crunch|obl[ií]quo|core)\b/i, "Abdômen"],
  [/\b(antebra[cç]o|forearm|wrist|punho)\b/i, "Antebraço"],
  [/\b(corrida|caminhada|bike|bicicleta|esteira|el[ií]ptico|nata[cç][aã]o|rem[oó] ergometro|cardio|aer[oó]bico|hiit|jump)\b/i, "Cardio"],
];

function inferGroupFromText(text: string | undefined | null): string | null {
  if (!text) return null;
  const lower = text.toLowerCase();
  // Explicit alias mentions (e.g. "Peito e tríceps" → Peito wins by first match order)
  for (const key of Object.keys(MUSCLE_ALIASES)) {
    // word-boundary match on the alias
    const re = new RegExp(`\\b${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
    if (re.test(lower)) return MUSCLE_ALIASES[key];
  }
  for (const [re, g] of NAME_GROUP_HINTS) if (re.test(lower)) return g;
  return null;
}

function parseLine(raw: string): ParsedExercise | null {
  let line = raw.trim();
  if (!line) return null;
  line = line.replace(/^\s*(?:\d+\s*[.)-]|[-*•])\s*/, "");

  // Accept ranges with hyphen, en-dash or em-dash: 6-8, 6–8, 12—15
  const setsRepsMatch = line.match(/(\d{1,2})\s*[x×]\s*([\w\-–—]+)/i);
  if (!setsRepsMatch) return null;
  const sets = Math.min(20, Math.max(1, parseInt(setsRepsMatch[1], 10)));
  const reps = setsRepsMatch[2].slice(0, 12);

  let name = line.slice(0, setsRepsMatch.index).trim();
  name = name.replace(/[:\-–—]+\s*$/, "").trim();
  if (!name) return null;

  const rest = line.slice((setsRepsMatch.index ?? 0) + setsRepsMatch[0].length);

  let weight: number | null = null;
  const wMatch =
    rest.match(/@\s*(\d+(?:[.,]\d+)?)\s*(?:kg)?/i) ||
    rest.match(/(\d+(?:[.,]\d+)?)\s*kg\b/i) ||
    rest.match(/\bcarga\s*[:=]?\s*(\d+(?:[.,]\d+)?)/i);
  if (wMatch) weight = parseFloat(wMatch[1].replace(",", "."));

  let restSec = 90;
  const rMin = rest.match(/(\d+)\s*m(?:in)?(?:\s*(\d+)s?)?/i);
  const rSec = rest.match(/(?:desc(?:anso)?|rest)\s*[:=]?\s*(\d+)\s*s?/i) || rest.match(/(\d+)\s*s\b/i);
  if (rMin) restSec = parseInt(rMin[1], 10) * 60 + (rMin[2] ? parseInt(rMin[2], 10) : 0);
  else if (rSec) restSec = parseInt(rSec[1], 10);
  restSec = Math.min(600, Math.max(0, restSec));

  return { name: name.slice(0, 80), sets, reps, weight_kg: weight, rest_seconds: restSec };
}

// Detects header lines like: "Treino A", "A - Peito e tríceps", "Dia 1: Pernas", "# B", "Workout 2"
function parseHeader(raw: string): { label: string; name: string } | null {
  const line = raw.trim().replace(/^#+\s*/, "");
  if (!line) return null;
  // "Treino A - Nome", "Treino A: Nome", "Treino A"
  let m = line.match(/^treino\s+([A-Za-z0-9]{1,3})\s*[:\-–—]?\s*(.*)$/i);
  if (m) return { label: m[1].toUpperCase(), name: (m[2] || "").trim() };
  // "Dia 1 - Nome" / "Dia 1: Nome"
  m = line.match(/^dia\s+([0-9]{1,2})\s*[:\-–—]?\s*(.*)$/i);
  if (m) return { label: m[1], name: (m[2] || "").trim() };
  // "Workout A"
  m = line.match(/^workout\s+([A-Za-z0-9]{1,3})\s*[:\-–—]?\s*(.*)$/i);
  if (m) return { label: m[1].toUpperCase(), name: (m[2] || "").trim() };
  // "A - Nome" / "A: Nome"  (single letter label)
  m = line.match(/^([A-H])\s*[:\-–—]\s*(.+)$/);
  if (m) return { label: m[1].toUpperCase(), name: m[2].trim() };
  // "A)" or "A."
  m = line.match(/^([A-H])\s*[.)]\s*(.*)$/);
  if (m) return { label: m[1].toUpperCase(), name: (m[2] || "").trim() };
  return null;
}

function parseBlocks(text: string): ParsedWorkoutBlock[] {
  const trimmed = text.trim();
  if (!trimmed) return [];

  // JSON support: array of blocks or single block
  if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
    try {
      const raw = JSON.parse(trimmed);
      const arr = Array.isArray(raw) ? raw : [raw];
      const blocks: ParsedWorkoutBlock[] = [];
      arr.forEach((b: any, idx: number) => {
        const exs = (b.exercises ?? []) as any[];
        const exercises = exs
          .map((r) => {
            const name = String(r.name ?? r.exercise ?? "").trim();
            if (!name) return null;
            return {
              name: name.slice(0, 80),
              sets: Math.min(20, Math.max(1, parseInt(String(r.sets ?? 3), 10) || 3)),
              reps: String(r.reps ?? "10").slice(0, 12),
              weight_kg:
                r.weight_kg != null || r.weight != null
                  ? parseFloat(String(r.weight_kg ?? r.weight).replace(",", ".")) || null
                  : null,
              rest_seconds: Math.min(600, Math.max(0, parseInt(String(r.rest_seconds ?? r.rest ?? 90), 10) || 90)),
              notes: r.notes ?? null,
            } as ParsedExercise;
          })
          .filter(Boolean) as ParsedExercise[];
        if (!exercises.length && !b.name && !b.label) return;
        blocks.push({
          label: String(b.label ?? String.fromCharCode(65 + idx)).toUpperCase().slice(0, 3),
          name: String(b.name ?? `Treino ${String.fromCharCode(65 + idx)}`).slice(0, 80),
          exercises,
        });
      });
      return blocks;
    } catch {
      // fall through
    }
  }

  const lines = trimmed.split(/\r?\n/);
  const blocks: ParsedWorkoutBlock[] = [];
  let current: ParsedWorkoutBlock | null = null;
  let autoIdx = 0;

  const pushCurrent = () => {
    if (current && current.exercises.length) blocks.push(current);
  };

  let currentGroup: string | null = null;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;
    // A line that IS an exercise takes priority
    const exMaybe = parseLine(line);
    const headerMaybe = exMaybe ? null : parseHeader(line);
    const groupMaybe = exMaybe || headerMaybe ? null : parseMuscleGroupHeader(line);

    if (headerMaybe) {
      pushCurrent();
      current = {
        label: headerMaybe.label,
        name: headerMaybe.name || `Treino ${headerMaybe.label}`,
        exercises: [],
      };
      // Try to infer default group from the block name (e.g. "Peito e tríceps")
      currentGroup = inferGroupFromText(headerMaybe.name);
      continue;
    }
    if (groupMaybe) {
      currentGroup = groupMaybe;
      continue;
    }
    if (exMaybe) {
      if (!current) {
        current = {
          label: String.fromCharCode(65 + autoIdx),
          name: `Treino ${String.fromCharCode(65 + autoIdx)}`,
          exercises: [],
        };
        autoIdx++;
      }
      const guessed = currentGroup ?? inferGroupFromText(exMaybe.name);
      if (guessed) exMaybe.muscle_group = guessed;
      current.exercises.push(exMaybe);
    }
  }
  pushCurrent();
  return blocks;
}

const EXAMPLE = `Treino A - Peito e tríceps
Supino reto 4x10 40kg desc 90s
Supino inclinado 3x12 desc 60s
Tríceps corda 4x12 desc:60

Treino B - Costas e bíceps
Puxada frente 4x10 desc 90s
Remada baixa 4x12
Rosca direta 3x12

Treino C - Pernas
Agachamento 4x10 60kg desc 120s
Leg press 3x15
Cadeira flexora 4x12`;

export function ImportWorkoutPlanDialog({
  userId,
  createdByTrainerId,
  onImported,
  triggerLabel,
}: {
  userId: string;
  createdByTrainerId?: string;
  onImported?: (created: { id: string; name: string }[]) => void;
  triggerLabel?: string;
}) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const online = useOnline();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [extracting, setExtracting] = useState(false);

  const blocks = useMemo(() => parseBlocks(text), [text]);

  async function handleFiles(files: FileList | File[]) {
    const arr = Array.from(files);
    if (!arr.length) return;
    setExtracting(true);
    try {
      const parts: string[] = [];
      for (const f of arr) {
        if (f.size > 15 * 1024 * 1024) {
          toast.error(`${f.name}: arquivo maior que 15MB`);
          continue;
        }
        try {
          const t = await extractTextFromFile(f);
          if (t.trim()) parts.push(`# ${f.name.replace(/\.[^.]+$/, "")}\n${t}`);
        } catch (e: any) {
          toast.error(`${f.name}: ${e.message ?? "falha ao ler"}`);
        }
      }
      if (parts.length) {
        setText((cur) => (cur ? cur + "\n\n" + parts.join("\n\n") : parts.join("\n\n")));
        toast.success(`${parts.length} arquivo(s) importado(s)`);
      }
    } finally {
      setExtracting(false);
    }
  }

  const { data: catalog = [] } = useQuery({
    enabled: open,
    queryKey: ["exercises-catalog-lite"],
    queryFn: async () => {
      const { data } = await supabase.from("exercises").select("id, name, muscle_group");
      return data ?? [];
    },
  });
  const { data: userWorkouts = [] } = useQuery({
    enabled: open,
    queryKey: ["workouts-labels", userId],
    queryFn: async () => {
      const { data } = await supabase.from("workouts").select("id, label, name").eq("user_id", userId);
      return data ?? [];
    },
  });

  const catalogByName = useMemo(() => {
    const m = new Map<string, { id: string; name: string; muscle_group: string }>();
    (catalog as any[]).forEach((e) => m.set(String(e.name).toLowerCase(), e));
    return m;
  }, [catalog]);

  const dryRun = useMemo(() => {
    const seenGlobal = new Set<string>();
    return blocks.map((b) => {
      const seenLocal = new Set<string>();
      const rows = b.exercises.map((p) => {
        const key = p.name.toLowerCase();
        const match = catalogByName.get(key);
        const duplicate = seenLocal.has(key);
        seenLocal.add(key);
        if (!match) seenGlobal.add(key);
        return {
          parsed: p,
          status: (match ? "matched" : duplicate ? "duplicate" : "new") as "matched" | "new" | "duplicate",
          matchGroup: match?.muscle_group ?? null,
        };
      });
      const conflict = (userWorkouts as any[]).some(
        (w) => (w.label ?? "").toLowerCase() === b.label.toLowerCase(),
      );
      return { block: b, rows, conflict };
    });
  }, [blocks, catalogByName, userWorkouts]);

  const totals = useMemo(() => {
    let matched = 0;
    let created = 0;
    const newNames = new Set<string>();
    for (const b of dryRun) {
      for (const r of b.rows) {
        if (r.status === "matched") matched++;
        else if (r.status === "new") {
          const k = r.parsed.name.toLowerCase();
          if (!newNames.has(k)) {
            newNames.add(k);
            created++;
          }
        }
      }
    }
    return { matched, created, workouts: dryRun.length };
  }, [dryRun]);

  function reset() {
    setText("");
  }

  const save = useMutation({
    mutationFn: async () => {
      if (!blocks.length) throw new Error("Nenhum treino reconhecido");

      const { count } = await supabase
        .from("workouts")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId);
      const baseIdx = count ?? 0;

      // Resolve/create all exercises across all blocks in one round
      const allNames = Array.from(
        new Set(blocks.flatMap((b) => b.exercises.map((e) => e.name))),
      );
      const { data: existing } = await supabase
        .from("exercises")
        .select("id, name")
        .in("name", allNames);
      const byName = new Map<string, string>();
      (existing ?? []).forEach((e: any) => byName.set(e.name.toLowerCase(), e.id));

      const missing = allNames.filter((n) => !byName.has(n.toLowerCase()));
      if (missing.length > 0) {
        const { data: created, error: cErr } = await supabase
          .from("exercises")
          .insert(
            missing.map((n) => ({ name: n, muscle_group: "Outros", is_default: false, created_by: userId })),
          )
          .select("id, name");
        if (cErr) throw cErr;
        (created ?? []).forEach((e: any) => byName.set(e.name.toLowerCase(), e.id));
      }

      const createdWorkouts: { id: string; name: string }[] = [];
      for (let i = 0; i < blocks.length; i++) {
        const b = blocks[i];
        const { data: workout, error: wErr } = await supabase
          .from("workouts")
          .insert({
            user_id: userId,
            label: b.label.slice(0, 3),
            name: b.name.slice(0, 80),
            order_idx: baseIdx + i,
            ...(createdByTrainerId ? { created_by_trainer_id: createdByTrainerId } : {}),
          })
          .select()
          .single();
        if (wErr) throw wErr;
        createdWorkouts.push({ id: workout.id, name: workout.name });

        const rows = b.exercises.map((p, idx) => ({
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
      }
      return createdWorkouts;
    },
    onSuccess: (created) => {
      toast.success(
        created.length === 1
          ? `Treino "${created[0].name}" importado`
          : `${created.length} treinos importados`,
      );
      qc.invalidateQueries({ queryKey: ["workouts"] });
      setOpen(false);
      reset();
      if (onImported) {
        onImported(created);
        return;
      }
      if (created.length === 1) {
        navigate({ to: "/app/treinos/$id", params: { id: created[0].id } });
      } else {
        navigate({ to: "/app/treinos" });
      }
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
          <Sparkles className="size-4" /> {triggerLabel ?? "Importar"}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Importar treino completo</DialogTitle>
          <DialogDescription>
            Cole o plano ou envie um arquivo (.pdf, .txt, .md, .csv, .json). Cada bloco "Treino A/B/C" vira
            um treino separado. Arquivos .fit/.gpx/.tcx são treinos executados — use "Importar treino" no
            histórico.
          </DialogDescription>
        </DialogHeader>

        <OfflineNotice feature="Importação de treino" />

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label>Plano completo</Label>
            <div className="flex gap-1">
              <label
                className={`inline-flex h-7 cursor-pointer items-center gap-1 rounded-md px-2 text-xs font-medium hover:bg-accent ${extracting ? "pointer-events-none opacity-60" : ""}`}
                title="Enviar .pdf, .txt, .md, .csv ou .json"
              >
                {extracting ? <Loader2 className="size-3.5 animate-spin" /> : <FileUp className="size-3.5" />}
                Arquivo
                <input
                  type="file"
                  multiple
                  accept=".pdf,.txt,.md,.csv,.json"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files?.length) void handleFiles(e.target.files);
                    e.target.value = "";
                  }}
                />
              </label>
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
            rows={10}
            placeholder={"Treino A - Peito e tríceps\nSupino reto 4x10 40kg desc 90s\n...\n\nTreino B - Costas\n..."}
            className="font-mono text-xs"
          />
          <p className="text-[11px] text-muted-foreground">
            Separe os treinos com cabeçalhos como <code>Treino A - Nome</code>, <code>Dia 1: Pernas</code> ou{" "}
            <code>B - Costas</code>. Uma linha em branco entre blocos ajuda na leitura.
          </p>
        </div>

        {blocks.length > 0 && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-secondary/40 px-3 py-2 text-xs">
              <span className="font-semibold">
                {totals.workouts} treino{totals.workouts > 1 ? "s" : ""} detectado
                {totals.workouts > 1 ? "s" : ""}
              </span>
              <span className="ml-auto flex gap-1.5">
                <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 font-semibold text-emerald-600 dark:text-emerald-400">
                  {totals.matched} vinculados
                </span>
                <span className="rounded bg-sky-500/15 px-1.5 py-0.5 font-semibold text-sky-600 dark:text-sky-400">
                  {totals.created} novos exercícios
                </span>
              </span>
            </div>

            {dryRun.map((b, bi) => (
              <div key={bi} className="rounded-xl border border-border">
                <div className="flex flex-wrap items-center gap-2 border-b border-border bg-secondary/40 px-3 py-2 text-xs">
                  <span className="rounded bg-primary/15 px-1.5 py-0.5 font-bold text-primary">
                    {b.block.label}
                  </span>
                  <span className="font-semibold">{b.block.name}</span>
                  <span className="text-muted-foreground">· {b.rows.length} exercícios</span>
                  {b.conflict && (
                    <span className="rounded bg-amber-500/15 px-1.5 py-0.5 font-semibold text-amber-600 dark:text-amber-400">
                      letra já existe
                    </span>
                  )}
                </div>
                <div className="max-h-48 overflow-y-auto">
                  <table className="w-full text-xs">
                    <tbody>
                      {b.rows.map((row, i) => {
                        const p = row.parsed;
                        const badge =
                          row.status === "matched"
                            ? { text: "Vinculado", cls: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" }
                            : row.status === "duplicate"
                            ? { text: "Duplicado", cls: "bg-muted text-muted-foreground" }
                            : { text: "Novo", cls: "bg-sky-500/15 text-sky-600 dark:text-sky-400" };
                        return (
                          <tr key={i} className="border-t border-border">
                            <td className="px-2 py-1.5">
                              <div className="font-medium">{p.name}</div>
                              {row.matchGroup && (
                                <div className="text-[10px] text-muted-foreground">{row.matchGroup}</div>
                              )}
                            </td>
                            <td className="px-2 py-1.5">
                              <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${badge.cls}`}>
                                {badge.text}
                              </span>
                            </td>
                            <td className="px-2 py-1.5 whitespace-nowrap text-muted-foreground">
                              {p.sets}×{p.reps}
                              {p.weight_kg ? ` · ${p.weight_kg}kg` : ""} · {p.rest_seconds}s
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
            <p className="text-[11px] text-muted-foreground">
              Nada é salvo até você clicar em <b>Importar</b>. Exercícios novos vão para o grupo "Outros" e
              podem ser ajustados depois.
            </p>
          </div>
        )}

        {text && blocks.length === 0 && (
          <p className="text-xs text-destructive">
            Nenhum exercício reconhecido. Cada linha precisa ter o formato <code>Nome NxR</code>.
          </p>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={save.isPending}>
            Cancelar
          </Button>
          <Button
            onClick={() => save.mutate()}
            disabled={blocks.length === 0 || save.isPending}
          >
            {save.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : blocks.length > 1 ? (
              `Importar ${blocks.length} treinos`
            ) : (
              "Importar treino"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
