// Conversão de CSVs de outros apps (Strong, Hevy, FitNotes) para o formato de
// texto simples que o importador de planos já entende — assim o mesmo
// matching por nome (fuzzy) é reaproveitado sem duplicar lógica.

export type CsvPlan = { text: string; app: string; exercises: number };

function splitCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else quoted = false;
      } else cell += c;
      continue;
    }
    if (c === '"') quoted = true;
    else if (c === "," || c === ";") {
      row.push(cell);
      cell = "";
    } else if (c === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else if (c !== "\r") cell += c;
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((v) => v.trim() !== ""));
}

const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");

function findIndex(headers: string[], candidates: string[]): number {
  const h = headers.map(norm);
  for (const c of candidates) {
    const i = h.indexOf(norm(c));
    if (i >= 0) return i;
  }
  for (const c of candidates) {
    const i = h.findIndex((x) => x.includes(norm(c)));
    if (i >= 0) return i;
  }
  return -1;
}

/** Detecta um CSV de Strong/Hevy/FitNotes pelo cabeçalho. */
export function isWorkoutAppCsv(text: string): boolean {
  const first = text.slice(0, 2000).split("\n")[0] ?? "";
  const h = norm(first);
  return (
    h.includes("exercise_name") ||
    (h.includes("exercise") && (h.includes("weight") || h.includes("reps")))
  );
}

const num = (v: string | undefined) => {
  if (!v) return null;
  const n = Number(String(v).replace(",", ".").replace(/[^0-9.\-]/g, ""));
  return Number.isFinite(n) && n !== 0 ? n : null;
};

/**
 * Converte o CSV em texto de plano ("Supino reto 4x10 60kg"), agrupando por
 * treino/data e resumindo as séries de cada exercício.
 */
export function workoutCsvToPlanText(text: string): CsvPlan {
  const rows = splitCsv(text);
  if (rows.length < 2) throw new Error("CSV vazio ou sem cabeçalho.");
  const headers = rows[0];

  const iEx = findIndex(headers, ["exercise_name", "exercise name", "exercise", "exercicio", "title"]);
  if (iEx < 0) throw new Error("Não encontrei a coluna do exercício (ex.: 'Exercise Name').");
  const iReps = findIndex(headers, ["reps", "repetitions", "repeticoes"]);
  const iWeight = findIndex(headers, ["weight_kg", "weight", "kg", "carga", "peso"]);
  const iDate = findIndex(headers, ["date", "start_time", "workout_date", "data"]);
  const iWorkout = findIndex(headers, ["workout_name", "workout", "title", "routine", "treino"]);

  const app = norm(headers.join(" ")).includes("start_time") ? "Hevy" : "Strong";

  type Agg = { name: string; sets: number; reps: number[]; weights: number[] };
  const groups = new Map<string, Map<string, Agg>>();

  for (const r of rows.slice(1)) {
    const name = (r[iEx] ?? "").trim();
    if (!name) continue;
    const groupLabel =
      (iWorkout >= 0 ? (r[iWorkout] ?? "").trim() : "") ||
      (iDate >= 0 ? (r[iDate] ?? "").trim().slice(0, 10) : "") ||
      "Treino importado";
    const g = groups.get(groupLabel) ?? new Map<string, Agg>();
    const cur = g.get(norm(name)) ?? { name, sets: 0, reps: [], weights: [] };
    cur.sets += 1;
    const reps = iReps >= 0 ? num(r[iReps]) : null;
    const weight = iWeight >= 0 ? num(r[iWeight]) : null;
    if (reps) cur.reps.push(reps);
    if (weight) cur.weights.push(weight);
    g.set(norm(name), cur);
    groups.set(groupLabel, g);
  }

  if (!groups.size) throw new Error("Nenhum exercício encontrado no CSV.");

  const lines: string[] = [];
  let exercises = 0;
  // Usa no máximo os 6 treinos mais recentes para não gerar um plano gigante.
  const entries = [...groups.entries()].slice(-6);
  for (const [label, g] of entries) {
    lines.push(`Treino ${label}`);
    for (const agg of g.values()) {
      exercises += 1;
      const repsMode = mode(agg.reps);
      const weight = agg.weights.length ? Math.max(...agg.weights) : null;
      lines.push(
        `${agg.name} ${agg.sets}x${repsMode ?? 10}${weight ? ` ${weight}kg` : ""}`,
      );
    }
    lines.push("");
  }

  return { text: lines.join("\n").trim(), app, exercises };
}

function mode(values: number[]): number | null {
  if (!values.length) return null;
  const counts = new Map<number, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0])[0][0];
}
