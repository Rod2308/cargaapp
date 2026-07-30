// Busca de imagem de exercício seguindo o mesmo padrão do restante do
// catálogo: a base pública free-exercise-db (yuhonas), a mesma origem das
// imagens `raw.githubusercontent.com/.../free-exercise-db/...` já usadas nos
// exercícios padrão do app.
//
// Fluxo: baixa o índice uma única vez (cacheado em memória + IndexedDB por 30
// dias), traduz o nome em português para termos em inglês e faz fuzzy match.
// Só quando nada casa é que o chamador cai no fallback genérico por grupo.

import Fuse from "fuse.js";
import { get, set } from "idb-keyval";

const INDEX_URL =
  "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json";
const IMAGE_BASE =
  "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/";
const CACHE_KEY = "carga.exercise-db.index.v1";
const CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 30;

type RawEntry = {
  name: string;
  images?: string[];
  equipment?: string | null;
  primaryMuscles?: string[];
};

export type ExerciseImageMatch = {
  image_url: string;
  equipment: string | null;
  muscle_group: string | null;
  source_name: string;
};

function stripAccents(s: string) {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

/** Termos PT → EN para aproximar o nome do vocabulário da base. */
const PT_EN_TERMS: Array<[RegExp, string]> = [
  [/\bsupino\b/g, "bench press"],
  [/\binclinado\b/g, "incline"],
  [/\bdeclinado\b/g, "decline"],
  [/\breto\b/g, "flat"],
  [/\bcrucifixo\b/g, "fly"],
  [/\bvoador\b/g, "pec deck fly"],
  [/\bcrossover\b/g, "cable crossover"],
  [/\bpuxada\b/g, "pulldown"],
  [/\balta\b/g, "wide grip"],
  [/\bremada\b/g, "row"],
  [/\bcurvada\b/g, "bent over"],
  [/\bbaixa\b/g, "seated cable"],
  [/\bbarra fixa\b/g, "pullups"],
  [/\blevantamento terra\b/g, "deadlift"],
  [/\bdesenvolvimento\b/g, "shoulder press"],
  [/\beleva(c|ç)(a|ã)o lateral\b/g, "lateral raise"],
  [/\beleva(c|ç)(a|ã)o frontal\b/g, "front raise"],
  [/\bencolhimento\b/g, "shrug"],
  [/\bmilitar\b/g, "military press"],
  [/\btr(i|í)ceps\b/g, "triceps"],
  [/\bfrances\b/g, "extension"],
  [/\btesta\b/g, "lying triceps extension"],
  [/\bcorda\b/g, "rope"],
  [/\bcoice\b/g, "kickback"],
  [/\bmergulho\b/g, "dips"],
  [/\bb(i|í)ceps\b/g, "biceps"],
  [/\brosca\b/g, "curl"],
  [/\bdireta\b/g, "barbell"],
  [/\bmartelo\b/g, "hammer"],
  [/\bscott\b/g, "preacher"],
  [/\bconcentrada\b/g, "concentration"],
  [/\bagachamento\b/g, "squat"],
  [/\bb(u|ú)lgaro\b/g, "bulgarian split"],
  [/\bcadeira extensora\b/g, "leg extension"],
  [/\b(cadeira|mesa) flexora\b/g, "leg curl"],
  [/\bleg press\b/g, "leg press"],
  [/\bafundo\b/g, "lunge"],
  [/\bavan(c|ç)o\b/g, "lunge"],
  [/\bpassada\b/g, "walking lunge"],
  [/\bst(i|í)ff\b/g, "stiff leg deadlift"],
  [/\bgl(u|ú)teo(s)?\b/g, "glute"],
  [/\beleva(c|ç)(a|ã)o p(e|é)lvica\b/g, "hip thrust"],
  [/\babdu(c|ç)(a|ã)o\b/g, "abduction"],
  [/\badu(c|ç)(a|ã)o\b/g, "adduction"],
  [/\bpanturrilha\b/g, "calf raise"],
  [/\bem p(e|é)\b/g, "standing"],
  [/\bsentado\b/g, "seated"],
  [/\bdeitado\b/g, "lying"],
  [/\babdominal(is)?\b/g, "crunches"],
  [/\babd(o|ô)men\b/g, "abdominal"],
  [/\bprancha\b/g, "plank"],
  [/\bobl(i|í)quo(s)?\b/g, "oblique"],
  [/\bantebra(c|ç)o\b/g, "forearm wrist curl"],
  [/\bpunho\b/g, "wrist"],
  [/\bflex(a|ã)o de bra(c|ç)o\b/g, "pushups"],
  [/\bflex(a|ã)o\b/g, "pushups"],
  [/\bcorrida\b/g, "running"],
  [/\bcaminhada\b/g, "walking"],
  [/\besteira\b/g, "treadmill"],
  [/\bbicicleta\b/g, "cycling"],
  [/\bel(i|í)ptico\b/g, "elliptical"],
  [/\bhalteres?\b/g, "dumbbell"],
  [/\bbarra\b/g, "barbell"],
  [/\bpolia\b/g, "cable"],
  [/\bm(a|á)quina\b/g, "machine"],
  [/\bpeso corporal\b/g, "body only"],
  [/\bunilateral\b/g, "one arm"],
  [/\bpegada\b/g, "grip"],
  [/\baberta\b/g, "wide"],
  [/\bfechada\b/g, "close"],
  [/\bneutra\b/g, "neutral"],
  [/\binversa\b/g, "reverse"],
  [/\bsupinada\b/g, "supine"],
  [/\bpronada\b/g, "pronated"],
];

const STOP = new Set(["com", "de", "da", "do", "das", "dos", "e", "em", "na", "no", "para", "a", "o", "ou", "um", "uma"]);

function toEnglishQuery(name: string): string {
  let s = ` ${stripAccents(name)} `;
  for (const [re, en] of PT_EN_TERMS) s = s.replace(re, ` ${en} `);
  return s
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t && !STOP.has(t))
    .join(" ")
    .trim();
}

/** primaryMuscles da base → grupo muscular em PT usado no catálogo. */
const MUSCLE_TO_GROUP: Record<string, string> = {
  chest: "Peito",
  lats: "Costas",
  "middle back": "Costas",
  "lower back": "Costas",
  traps: "Ombros",
  shoulders: "Ombros",
  triceps: "Tríceps",
  biceps: "Bíceps",
  forearms: "Antebraço",
  quadriceps: "Pernas",
  hamstrings: "Pernas",
  adductors: "Pernas",
  abductors: "Pernas",
  glutes: "Glúteos",
  calves: "Panturrilha",
  abdominals: "Abdômen",
  neck: "Ombros",
};

const EQUIPMENT_TO_PT: Record<string, string> = {
  barbell: "Barra",
  dumbbell: "Halteres",
  cable: "Polia",
  machine: "Máquina",
  "body only": "Peso corporal",
  kettlebells: "Kettlebell",
  bands: "Elástico",
  "medicine ball": "Bola",
  "exercise ball": "Bola",
  "e-z curl bar": "Barra W",
  "foam roll": "Rolo",
  other: "Livre",
};

let memoryIndex: RawEntry[] | null = null;
let loading: Promise<RawEntry[] | null> | null = null;

async function loadIndex(): Promise<RawEntry[] | null> {
  if (memoryIndex) return memoryIndex;
  if (loading) return loading;

  loading = (async () => {
    try {
      const cached = await get<{ at: number; data: RawEntry[] }>(CACHE_KEY);
      if (cached && Date.now() - cached.at < CACHE_TTL_MS && Array.isArray(cached.data)) {
        memoryIndex = cached.data;
        return memoryIndex;
      }
    } catch {
      /* cache indisponível */
    }

    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 8000);
      const res = await fetch(INDEX_URL, { signal: ctrl.signal });
      clearTimeout(t);
      if (!res.ok) return null;
      const json = (await res.json()) as RawEntry[];
      const slim = json
        .filter((e) => e?.name && e.images?.length)
        .map((e) => ({
          name: e.name,
          images: [e.images![0]],
          equipment: e.equipment ?? null,
          primaryMuscles: e.primaryMuscles ?? [],
        }));
      memoryIndex = slim;
      void set(CACHE_KEY, { at: Date.now(), data: slim }).catch(() => {});
      return memoryIndex;
    } catch {
      return null;
    } finally {
      loading = null;
    }
  })();

  return loading;
}

let fuse: Fuse<RawEntry> | null = null;

/**
 * Tenta achar uma imagem "de verdade" para o exercício na base pública.
 * Retorna null quando não há match confiável — aí o chamador usa o fallback
 * genérico por grupo muscular.
 */
export async function lookupExerciseImage(name: string): Promise<ExerciseImageMatch | null> {
  const index = await loadIndex();
  if (!index || index.length === 0) return null;

  if (!fuse) {
    fuse = new Fuse(index, {
      keys: ["name"],
      includeScore: true,
      threshold: 0.38,
      ignoreLocation: true,
    });
  }

  const query = toEnglishQuery(name);
  if (!query || query.length < 3) return null;

  const [best] = fuse.search(query, { limit: 1 });
  if (!best || (best.score ?? 1) > 0.38) return null;

  const entry = best.item;
  const image = entry.images?.[0];
  if (!image) return null;

  const primary = (entry.primaryMuscles ?? [])[0]?.toLowerCase() ?? "";
  const equipment = (entry.equipment ?? "").toLowerCase();

  return {
    image_url: `${IMAGE_BASE}${image.replace(/^exercises\//, "")}`,
    equipment: EQUIPMENT_TO_PT[equipment] ?? null,
    muscle_group: MUSCLE_TO_GROUP[primary] ?? null,
    source_name: entry.name,
  };
}
