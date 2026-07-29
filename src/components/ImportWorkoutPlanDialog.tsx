import { useEffect, useMemo, useState } from "react";
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
  preferred_match?: string | null;
  /** Linha que não bateu com nenhum padrão numérico — precisa de revisão manual. */
  unrecognized?: boolean;
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

const FALLBACK_IMAGE_BY_GROUP: Record<string, string> = {
  Peito: "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Barbell_Bench_Press_-_Medium_Grip/0.jpg",
  Costas: "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Wide-Grip_Lat_Pulldown/0.jpg",
  Ombros: "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Standing_Military_Press/0.jpg",
  Tríceps: "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Triceps_Pushdown_-_Rope_Attachment/0.jpg",
  Bíceps: "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Barbell_Curl/0.jpg",
  Pernas: "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Barbell_Squat/0.jpg",
  Glúteos: "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Barbell_Hip_Thrust/0.jpg",
  Panturrilha: "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Standing_Calf_Raises/0.jpg",
  Abdômen: "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Crunches/0.jpg",
  Cardio: "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Running_Treadmill/0.jpg",
};

const FALLBACK_EQUIPMENT_BY_GROUP: Record<string, string> = {
  Peito: "Banco",
  Costas: "Polia",
  Ombros: "Barra",
  Tríceps: "Polia",
  Bíceps: "Barra",
  Pernas: "Livre",
  Glúteos: "Barra",
  Panturrilha: "Livre",
  Abdômen: "Peso corporal",
  Cardio: "Esteira",
};

function normalizeRepRange(value: string): string {
  return value.replace(/[–—]/g, "-").replace(/\s+/g, " ").trim().slice(0, 12);
}

function parseLine(raw: string): ParsedExercise | null {
  let line = raw.trim();
  if (!line) return null;
  line = line.replace(/^\s*(?:\d+\s*[.)-]|[-*•])\s*/, "");

  const cardioMatch = line.match(/^(cardio|aer[oó]bico|condicionamento)\s*[:\-–—]\s*(.+)$/i);
  if (cardioMatch) {
    const details = cardioMatch[2].trim();
    const durationRange = details.match(/(\d{1,3})\s*[-–—]\s*(\d{1,3})\s*(?:min|mins|minutos?)\b/i);
    const durationSingle = details.match(/(\d{1,3})\s*(?:min|mins|minutos?)\b/i);
    const reps = durationRange
      ? `${durationRange[1]}-${durationRange[2]} min`
      : durationSingle
        ? `${durationSingle[1]} min`
        : normalizeRepRange(details || "30 min");
    return {
      name: "Cardio",
      sets: 1,
      reps,
      weight_kg: null,
      rest_seconds: 0,
      notes: details || null,
      muscle_group: "Cardio",
      preferred_match: "Esteira - corrida",
    };
  }

  const seriesOnlyMatch = line.match(/^(.+?)\s*[:\-–—]\s*(\d{1,2})(?:\s*[-–—]\s*(\d{1,2}))?\s*s[eé]ries?\b/i);
  if (seriesOnlyMatch) {
    const name = seriesOnlyMatch[1].trim().replace(/[:\-–—]+\s*$/, "").slice(0, 80);
    if (!name) return null;
    const minSets = parseInt(seriesOnlyMatch[2], 10);
    const maxSets = seriesOnlyMatch[3] ? parseInt(seriesOnlyMatch[3], 10) : minSets;
    const sets = Math.min(20, Math.max(1, maxSets));
    const notes = seriesOnlyMatch[3] ? `${minSets}-${maxSets} séries` : `${sets} séries`;
    return {
      name,
      sets,
      reps: "livre",
      weight_kg: null,
      rest_seconds: 60,
      notes,
      muscle_group: inferGroupFromText(name),
    };
  }

  // "Supino 3 séries de 12 repetições", "Supino: 3 series x 12 reps"
  const verboseMatch = line.match(
    /^(.+?)\s*[:\-–—]?\s*(\d{1,2})\s*s[eé]ries?\s*(?:de|x|×)?\s*(\d{1,2}(?:\s*[-–—]\s*\d{1,2})?)\s*(?:rep(?:s|eti[cç][oõ]es)?)?/i,
  );
  if (verboseMatch && verboseMatch[1].trim()) {
    const vName = verboseMatch[1].trim().replace(/[:\-–—]+\s*$/, "").slice(0, 80);
    const tail = line.slice((verboseMatch.index ?? 0) + verboseMatch[0].length);
    const wm = tail.match(/(\d+(?:[.,]\d+)?)\s*kg\b/i) || line.match(/(\d+(?:[.,]\d+)?)\s*kg\b/i);
    return {
      name: vName,
      sets: Math.min(20, Math.max(1, parseInt(verboseMatch[2], 10))),
      reps: normalizeRepRange(verboseMatch[3]),
      weight_kg: wm ? parseFloat(wm[1].replace(",", ".")) : null,
      rest_seconds: 90,
      muscle_group: inferGroupFromText(vName),
    };
  }

  // Accept ranges with hyphen, en-dash or em-dash: 6-8, 6–8, 12—15
  const setsRepsMatch = line.match(/(\d{1,2})\s*[x×]\s*([\w\-–—]+)/i);
  if (!setsRepsMatch) return null;

  const sets = Math.min(20, Math.max(1, parseInt(setsRepsMatch[1], 10)));
  const reps = normalizeRepRange(setsRepsMatch[2]);

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

// Normalize free-form pasted text so the line-based parser can read it:
// - collapse divider glyphs (⸻ ─ ═) into blank lines
// - promote bullet markers (* • –) into line breaks
// - split cabeçalhos ("Treino X", "Cardio:") em nova linha quando grudados
// - insert newline entre `)Peito*` e antes de nomes de grupo colados a texto
function normalizeInput(text: string): string {
  const groupWord =
    "Peito|Peitorais?|Ombros?|Tr[ií]ceps|B[ií]ceps|Costas|Dorsais?|Pernas?|Quadr[ií]ceps|Posterior(?:\\s+d[ao]\\s+(?:coxa|ombro))?|Gl[uú]teos?|Panturrilhas?|Abd[oô]men|Abdominais?|Antebra[cç]o|Trap[eé]zio|Cardio|Aer[oó]bico";
  return text
    .replace(/[⸻─═]{1,}/g, "\n\n")
    .replace(/([^\n])\s*[*•]\s*/g, "$1\n")
    .replace(/(\))\s*([A-ZÁÉÍÓÚÂÊÔÃÕÇ])/g, "$1\n$2")
    .replace(/([^\n])\s*(Treino\s+[A-Za-z0-9])/g, "$1\n$2")
    .replace(/([^\n])\s*(Dia\s+\d+)/gi, "$1\n$2")
    .replace(/([^\n])\s*(Cardio\s*[:\-–—])/gi, "$1\n$2")
    .replace(new RegExp(`([^\\n\\s])\\s*(${groupWord})(\\s*[:\\-–—]|\\s*\\n|\\s+[A-ZÁ])`, "gi"), "$1\n$2$3")
    .replace(/\n{3,}/g, "\n\n");
}

function parseBlocks(text: string): ParsedWorkoutBlock[] {
  const trimmed = normalizeInput(text).trim();
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
              muscle_group:
                (typeof r.muscle_group === "string" && r.muscle_group.trim()) ||
                inferGroupFromText(String(r.name ?? r.exercise ?? "")) ||
                (typeof b.muscle_group === "string" ? b.muscle_group : null),
              preferred_match: typeof r.preferred_match === "string" ? r.preferred_match : null,
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
    const ensureBlock = (): ParsedWorkoutBlock => {
      if (current) return current;
      const blk: ParsedWorkoutBlock = {
        label: String.fromCharCode(65 + autoIdx),
        name: `Treino ${String.fromCharCode(65 + autoIdx)}`,
        exercises: [],
      };
      autoIdx++;
      current = blk;
      return blk;
    };


    if (exMaybe) {
      const blk = ensureBlock();
      const guessed = inferGroupFromText(exMaybe.name) ?? currentGroup;
      if (guessed) exMaybe.muscle_group = guessed;
      blk.exercises.push(exMaybe);
      continue;
    }

    // Linha com cara de exercício mas sem padrão numérico reconhecido:
    // entra como "não reconhecido" para o usuário resolver na revisão.
    const looksLikeExercise =
      /[a-zà-ÿ]{3,}/i.test(line) && line.length <= 60 && !/^(obs|observa|aquecimento|alongamento)/i.test(line);
    if (looksLikeExercise) {
      const blk = ensureBlock();
      blk.exercises.push({
        name: line.replace(/[:\-–—]+\s*$/, "").slice(0, 80),
        sets: 3,
        reps: "10",
        weight_kg: null,
        rest_seconds: 90,
        muscle_group: inferGroupFromText(line) ?? currentGroup,
        unrecognized: true,
      });
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
  const [ocrPct, setOcrPct] = useState<number | null>(null);
  // Revisão editável: começa como cópia do que o parser leu e o usuário ajusta linha a linha.
  const [edited, setEdited] = useState<ParsedWorkoutBlock[] | null>(null);
  // Vínculo manual de exercício por linha: "bi:ri" -> exercise id
  const [manualMatch, setManualMatch] = useState<Record<string, string>>({});

  const parsedBlocks = useMemo(() => parseBlocks(text), [text]);
  useEffect(() => {
    setEdited(null);
    setManualMatch({});
  }, [text]);
  const blocks = edited ?? parsedBlocks;

  const patchBlocks = (fn: (draft: ParsedWorkoutBlock[]) => ParsedWorkoutBlock[]) =>
    setEdited(fn(blocks.map((b) => ({ ...b, exercises: b.exercises.map((e) => ({ ...e })) }))));

  const updateRow = (bi: number, ri: number, patch: Partial<ParsedExercise>) =>
    patchBlocks((d) => {
      d[bi].exercises[ri] = { ...d[bi].exercises[ri], ...patch, unrecognized: false };
      return d;
    });

  const removeRow = (bi: number, ri: number) =>
    patchBlocks((d) => {
      d[bi].exercises.splice(ri, 1);
      return d.filter((b) => b.exercises.length);
    });

  const updateBlockMeta = (bi: number, patch: Partial<Pick<ParsedWorkoutBlock, "label" | "name">>) =>
    patchBlocks((d) => {
      d[bi] = { ...d[bi], ...patch };
      return d;
    });

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
          setOcrPct(null);
          const t = await extractTextFromFile(f, (pct) => setOcrPct(pct));
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
      setOcrPct(null);
    }

  }

  const { data: catalog = [] } = useQuery({
    enabled: open,
    queryKey: ["exercises-catalog-lite"],
    queryFn: async () => {
      const { data } = await supabase.from("exercises").select("id, name, muscle_group, image_url, is_default, equipment");
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

  // --- Fuzzy catalog matching ------------------------------------------------
  const stripAccents = (s: string) =>
    s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const CATALOG_NAME_ALIASES: Record<string, string[]> = {
    "supino reto": ["Supino reto com barra", "Supino reto barra", "Supino reto com halteres"],
    "supino inclinado": ["Supino inclinado com halteres", "Supino inclinado com barra", "Incline Dumbbell Bench Press", "Incline Bench Press"],
    "supino inclinado halteres": ["Supino inclinado com halteres", "Incline Dumbbell Bench Press"],
    "supino inclinado com halteres": ["Incline Dumbbell Bench Press", "Supino inclinado com halteres"],
    "crossover": ["Crossover na polia"],
    "desenvolvimento": ["Desenvolvimento militar com barra", "Desenvolvimento com halteres", "Standing Military Press"],
    "elevacao lateral": ["Elevação lateral com halteres", "Seated Side Lateral Raise", "One-Arm Side Laterals"],
    "elevação lateral": ["Elevação lateral com halteres", "Seated Side Lateral Raise", "One-Arm Side Laterals"],
    "triceps corda": ["Tríceps na polia com corda"],
    "triceps frances": ["Tríceps francês na polia alta", "Francês com halter"],
    "tríceps corda": ["Tríceps na polia com corda", "Triceps Pushdown - Rope Attachment"],
    "tríceps francês": ["Tríceps francês na polia alta", "Cable Incline Triceps Extension"],
    "barra fixa ou puxada alta": ["Puxada alta", "Wide-Grip Lat Pulldown", "Pullups"],
    "puxada alta": ["Wide-Grip Lat Pulldown", "Puxada alta"],
    "barra fixa": ["Pullups", "Barra fixa"],
    "remada curvada": ["Remada curvada com barra", "Bent Over Barbell Row"],
    "remada baixa": ["Remada baixa", "Seated Cable Rows"],
    "pulldown": ["Straight-Arm Pulldown", "Rope Straight-Arm Pulldown", "Wide-Grip Lat Pulldown"],
    "face pull": ["Face Pull"],
    "rosca direta": ["Rosca direta com barra", "Barbell Curl"],
    "rosca martelo": ["Rosca martelo", "Hammer Curls", "Alternate Hammer Curl"],
    "agachamento livre": ["Agachamento livre", "Barbell Squat", "Barbell Full Squat"],
    "leg press": ["Leg Press"],
    "cadeira extensora": ["Cadeira extensora", "Leg Extensions"],
    "afundo": ["Afundo", "Dumbbell Lunges", "Barbell Lunge"],
    "panturrilha em pe": ["Panturrilha em pé", "Standing Calf Raises", "Calf Press On The Leg Press Machine"],
    "panturrilha em pé": ["Panturrilha em pé", "Standing Calf Raises", "Calf Press On The Leg Press Machine"],
    "panturrilha": ["Panturrilha em pé", "Standing Calf Raises", "Calf Press On The Leg Press Machine"],
    "abdomen": ["Abdominal", "Crunches", "Plank"],
    "abdômen": ["Abdominal", "Crunches", "Plank"],
    "abdominal": ["Abdominal", "Crunches", "Plank"],
    "cardio": ["Esteira - corrida", "Bicicleta ergométrica", "Cardio"],
  };

  const DEFAULT_METADATA_BY_NAME: Record<string, { muscle_group: string; equipment: string; image_url: string }> = {
    "supino reto": {
      muscle_group: "Peito",
      equipment: "Barra",
      image_url: "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Barbell_Bench_Press_-_Medium_Grip/0.jpg",
    },
    "supino inclinado": {
      muscle_group: "Peito",
      equipment: "Barra",
      image_url: "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Barbell_Incline_Bench_Press_-_Medium_Grip/0.jpg",
    },
    "supino inclinado com halteres": {
      muscle_group: "Peito",
      equipment: "Halteres",
      image_url: "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Incline_Dumbbell_Press/0.jpg",
    },
    "crossover": {
      muscle_group: "Peito",
      equipment: "Polia",
      image_url: "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Cable_Crossover/0.jpg",
    },
    "desenvolvimento": {
      muscle_group: "Ombros",
      equipment: "Barra",
      image_url: "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Standing_Military_Press/0.jpg",
    },
    "elevacao lateral": {
      muscle_group: "Ombros",
      equipment: "Halteres",
      image_url: "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Seated_Side_Lateral_Raise/0.jpg",
    },
    "triceps corda": {
      muscle_group: "Tríceps",
      equipment: "Polia",
      image_url: "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Triceps_Pushdown_-_Rope_Attachment/0.jpg",
    },
    "triceps frances": {
      muscle_group: "Tríceps",
      equipment: "Polia",
      image_url: "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Cable_Incline_Triceps_Extension/0.jpg",
    },
    "barra fixa": {
      muscle_group: "Costas",
      equipment: "Peso corporal",
      image_url: "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Pullups/0.jpg",
    },
    "barra fixa ou puxada alta": {
      muscle_group: "Costas",
      equipment: "Polia",
      image_url: "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Wide-Grip_Lat_Pulldown/0.jpg",
    },
    "puxada alta": {
      muscle_group: "Costas",
      equipment: "Polia",
      image_url: "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Wide-Grip_Lat_Pulldown/0.jpg",
    },
    "remada curvada": {
      muscle_group: "Costas",
      equipment: "Barra",
      image_url: "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Bent_Over_Barbell_Row/0.jpg",
    },
    "remada baixa": {
      muscle_group: "Costas",
      equipment: "Polia",
      image_url: "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Seated_Cable_Rows/0.jpg",
    },
    pulldown: {
      muscle_group: "Costas",
      equipment: "Polia",
      image_url: "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Straight-Arm_Pulldown/0.jpg",
    },
    "face pull": {
      muscle_group: "Ombros",
      equipment: "Polia",
      image_url: "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Face_Pull/0.jpg",
    },
    "rosca direta": {
      muscle_group: "Bíceps",
      equipment: "Barra",
      image_url: "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Barbell_Curl/0.jpg",
    },
    "rosca martelo": {
      muscle_group: "Bíceps",
      equipment: "Halteres",
      image_url: "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Hammer_Curls/0.jpg",
    },
    "agachamento livre": {
      muscle_group: "Pernas",
      equipment: "Barra",
      image_url: "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Barbell_Squat/0.jpg",
    },
    "leg press": {
      muscle_group: "Pernas",
      equipment: "Máquina",
      image_url: "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Leg_Press/0.jpg",
    },
    "cadeira extensora": {
      muscle_group: "Pernas",
      equipment: "Máquina",
      image_url: "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Leg_Extensions/0.jpg",
    },
    afundo: {
      muscle_group: "Pernas",
      equipment: "Halteres",
      image_url: "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Dumbbell_Lunges/0.jpg",
    },
    cardio: {
      muscle_group: "Cardio",
      equipment: "Esteira",
      image_url: "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Running_Treadmill/0.jpg",
    },
    "panturrilha em pe": {
      muscle_group: "Panturrilha",
      equipment: "Livre",
      image_url: "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Standing_Calf_Raises/0.jpg",
    },
    "panturrilha em pé": {
      muscle_group: "Panturrilha",
      equipment: "Livre",
      image_url: "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Standing_Calf_Raises/0.jpg",
    },
    panturrilha: {
      muscle_group: "Panturrilha",
      equipment: "Livre",
      image_url: "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Standing_Calf_Raises/0.jpg",
    },
    abdomen: {
      muscle_group: "Abdômen",
      equipment: "Peso corporal",
      image_url: "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Crunches/0.jpg",
    },
    "abdômen": {
      muscle_group: "Abdômen",
      equipment: "Peso corporal",
      image_url: "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Crunches/0.jpg",
    },
    abdominal: {
      muscle_group: "Abdômen",
      equipment: "Peso corporal",
      image_url: "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Crunches/0.jpg",
    },
  };

  const getDefaultMetadata = (name: string, group?: string | null) => {
    const byName = DEFAULT_METADATA_BY_NAME[stripAccents(name)];
    if (byName) return byName;
    const fallbackGroup = group ?? inferGroupFromText(name);
    if (!fallbackGroup) return null;
    const image_url = FALLBACK_IMAGE_BY_GROUP[fallbackGroup];
    const equipment = FALLBACK_EQUIPMENT_BY_GROUP[fallbackGroup];
    if (!image_url && !equipment) return null;
    return {
      muscle_group: fallbackGroup,
      equipment: equipment ?? "Livre",
      image_url: image_url ?? "",
    };
  };

  const buildExerciseRepair = (
    current: { name: string; muscle_group?: string | null; image_url?: string | null; equipment?: string | null },
    detectedGroup?: string | null,
  ) => {
    const metadata = getDefaultMetadata(current.name, detectedGroup);
    if (!metadata) return null;

    const nextGroup = current.muscle_group && current.muscle_group !== "Outros" ? current.muscle_group : metadata.muscle_group;
    const patch = {
      ...((!current.muscle_group || current.muscle_group === "Outros") && nextGroup ? { muscle_group: nextGroup } : {}),
      ...(!current.image_url && metadata.image_url ? { image_url: metadata.image_url } : {}),
      ...(!current.equipment && metadata.equipment ? { equipment: metadata.equipment } : {}),
    };

    return Object.keys(patch).length ? patch : null;
  };
  const STOPWORDS = new Set([
    "com", "de", "da", "do", "das", "dos", "e", "em", "na", "no", "para", "a", "o",
    "ou", "um", "uma", "the",
  ]);
  const tokenize = (s: string) =>
    stripAccents(s)
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((t) => t && !STOPWORDS.has(t));

  const catalogIndex = useMemo(() => {
    return (catalog as any[]).map((e) => ({
      id: e.id as string,
      name: String(e.name),
      muscle_group: String(e.muscle_group ?? ""),
      image_url: typeof e.image_url === "string" ? e.image_url : null,
      is_default: Boolean(e.is_default),
      equipment: typeof e.equipment === "string" ? e.equipment : null,
      key: stripAccents(String(e.name)),
      tokens: new Set(tokenize(String(e.name))),
    }));
  }, [catalog]);

  const catalogByName = useMemo(() => {
    const m = new Map<string, { id: string; name: string; muscle_group: string; image_url?: string | null; is_default?: boolean; equipment?: string | null }>();
    (catalog as any[]).forEach((e) => {
      const key = stripAccents(String(e.name));
      const current = m.get(key);
      const candidate = {
        id: e.id as string,
        name: String(e.name),
        muscle_group: String(e.muscle_group ?? ""),
        image_url: typeof e.image_url === "string" ? e.image_url : null,
        is_default: Boolean(e.is_default),
        equipment: typeof e.equipment === "string" ? e.equipment : null,
      };
      const currentScore = (current?.image_url ? 2 : 0) + (current?.is_default ? 1 : 0);
      const candidateScore = (candidate.image_url ? 2 : 0) + (candidate.is_default ? 1 : 0);
      if (!current || candidateScore > currentScore) m.set(key, candidate);
    });
    return m;
  }, [catalog]);

  const matchExercise = (
    parsedName: string,
    contextGroup?: string | null,
    preferredMatch?: string | null,
  ): { id: string; name: string; muscle_group: string; image_url?: string | null; equipment?: string | null } | null => {
    const key = stripAccents(parsedName);
    const aliasCandidates = [
      ...(preferredMatch ? [preferredMatch] : []),
      ...(CATALOG_NAME_ALIASES[key] ?? []),
    ];
    for (const candidateName of aliasCandidates) {
      const aliasMatch = catalogByName.get(stripAccents(candidateName));
      if (aliasMatch) return aliasMatch;
    }

    const tokens = tokenize(parsedName);
    if (!tokens.length) return null;

    // 1) prefer subset match (all parsed tokens present in catalog name), but
    //    rank default/image-rich catalog rows over old custom rows without media.
    let best: { entry: (typeof catalogIndex)[number]; score: number } | null = null;
    for (const c of catalogIndex) {
      let hits = 0;
      for (const t of tokens) if (c.tokens.has(t)) hits++;
      if (hits !== tokens.length) continue;
      const extra = c.tokens.size - hits;
      let score = 100 - extra * 5;
      if (contextGroup && c.muscle_group === contextGroup) score += 25;
      else if (contextGroup && c.muscle_group !== contextGroup) score -= 20;
      if (c.image_url) score += 15;
      if (c.is_default) score += 8;
      if (c.key === key) score += c.image_url ? 10 : -25;
      if (!best || score > best.score) best = { entry: c, score };
    }
    if (best) {
      return {
        id: best.entry.id,
        name: best.entry.name,
        muscle_group: best.entry.muscle_group,
        image_url: best.entry.image_url,
        equipment: best.entry.equipment,
      };
    }

    // 2) fallback: at least one strong token (>=3 chars) matches, weighted by
    //    coverage + context group. Prevents "Barra fixa ou puxada alta" or
    //    "Puxada alta" from becoming a new "Outros" exercise.
    for (const c of catalogIndex) {
      let hits = 0;
      for (const t of tokens) if (t.length >= 3 && c.tokens.has(t)) hits++;
      if (hits === 0) continue;
      const coverage = hits / Math.max(tokens.length, c.tokens.size);
      let score = 40 + coverage * 40 + hits * 5;
      if (contextGroup && c.muscle_group === contextGroup) score += 20;
      else if (contextGroup && c.muscle_group !== contextGroup) score -= 15;
      if (c.image_url) score += 10;
      if (c.is_default) score += 5;
      if (!best || score > best.score) best = { entry: c, score };
    }
    return best && best.score >= 55
      ? {
          id: best.entry.id,
          name: best.entry.name,
          muscle_group: best.entry.muscle_group,
          image_url: best.entry.image_url,
          equipment: best.entry.equipment,
        }
      : null;
  };


  const dryRun = useMemo(() => {
    return blocks.map((b) => {
      const seenLocal = new Set<string>();
      const rows = b.exercises.map((p) => {
        const key = stripAccents(p.name);
        const ctxGroup = p.muscle_group ?? inferGroupFromText(p.name) ?? inferGroupFromText(b.name) ?? null;
        const match = matchExercise(p.name, ctxGroup, p.preferred_match);
        const duplicate = seenLocal.has(key);
        seenLocal.add(key);
        const matchGroup = match?.muscle_group && match.muscle_group !== "Outros" ? match.muscle_group : ctxGroup;
        return {
          parsed: p,
          match,
          status: (match ? "matched" : duplicate ? "duplicate" : "new") as "matched" | "new" | "duplicate",
          matchGroup,
        };
      });
      const conflict = (userWorkouts as any[]).some(
        (w) => (w.label ?? "").toLowerCase() === b.label.toLowerCase(),
      );
      return { block: b, rows, conflict };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blocks, catalogIndex, catalogByName, userWorkouts]);

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

      // Resolve exercises: prefer fuzzy match against the catalog (from dryRun),
      // then existing rows by exact name, then create as last resort.
      const idByParsedKey = new Map<string, string>(); // key = normalized parsed name
      const groupByParsedKey = new Map<string, string>();

      for (const b of dryRun) {
        for (const r of b.rows) {
          const key = stripAccents(r.parsed.name);
          if (r.match) {
            idByParsedKey.set(key, r.match.id);
            const repair = buildExerciseRepair(
              {
                name: r.match.name,
                muscle_group: r.match.muscle_group,
                image_url: r.match.image_url,
                equipment: r.match.equipment,
              },
              r.matchGroup,
            );

            if (repair) {
              const { error: repairErr } = await supabase
                .from("exercises")
                .update(repair)
                .eq("id", r.match.id);
              if (repairErr) throw repairErr;
            }
          }
          if (r.matchGroup) groupByParsedKey.set(key, r.matchGroup);
        }
      }

      // Only rows without a fuzzy match need a DB lookup / creation.
      const unresolvedNames = Array.from(
        new Set(
          blocks
            .flatMap((b) => b.exercises.map((e) => e.name))
            .filter((n) => !idByParsedKey.has(stripAccents(n))),
        ),
      );

      if (unresolvedNames.length > 0) {
        const { data: existing } = await supabase
          .from("exercises")
          .select("id, name, muscle_group, image_url, equipment")
          .in("name", unresolvedNames);
        for (const e of existing ?? []) {
          const key = stripAccents(e.name);
          idByParsedKey.set(key, e.id);

          const repair = buildExerciseRepair(e, groupByParsedKey.get(key));
          if (repair) {
            const { error: repairErr } = await supabase
              .from("exercises")
              .update(repair)
              .eq("id", e.id);
            if (repairErr) throw repairErr;
          }
        }
      }

      const missing = Array.from(
        new Set(
          blocks
            .flatMap((b) => b.exercises.map((e) => e.name))
            .filter((n) => !idByParsedKey.has(stripAccents(n))),
        ),
      );
      if (missing.length > 0) {
        const { data: created, error: cErr } = await supabase
          .from("exercises")
          .insert(
            missing.map((n) => {
              const detectedGroup = groupByParsedKey.get(stripAccents(n));
              const metadata = getDefaultMetadata(n, detectedGroup);
              return {
                name: n,
                muscle_group: metadata?.muscle_group ?? detectedGroup ?? "Outros",
                equipment: metadata?.equipment ?? null,
                image_url: metadata?.image_url || null,
                is_default: false,
                created_by: userId,
              };
            }),
          )
          .select("id, name");
        if (cErr) throw cErr;
        (created ?? []).forEach((e: any) => idByParsedKey.set(stripAccents(e.name), e.id));
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

        const rows = b.exercises.map((p, idx) => {
          const exerciseId = idByParsedKey.get(stripAccents(p.name));
          if (!exerciseId) throw new Error(`Exercício não resolvido: ${p.name}`);
          return {
            workout_id: workout.id,
            exercise_id: exerciseId,
            order_idx: idx,
            target_sets: p.sets,
            target_reps: p.reps,
            target_weight_kg: p.weight_kg,
            target_rest_seconds: p.rest_seconds,
            notes: p.notes ?? null,
          };
        });
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
                              {row.match && stripAccents(row.match.name) !== stripAccents(p.name) && (
                                <div className="text-[10px] text-muted-foreground">
                                  → {row.match.name}
                                </div>
                              )}
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
              Nada é salvo até você clicar em <b>Importar</b>. Exercícios novos usam o grupo muscular detectado
              e recebem uma imagem padrão quando houver contexto suficiente.
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
