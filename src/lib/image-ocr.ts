// OCR 100% local (tesseract.js roda no navegador). Nenhuma IA/LLM ou API externa.
// Usado para transformar uma foto/print de ficha de treino em texto bruto,
// que depois passa pelo mesmo parser por regex do "colar texto".
//
// Além do texto puro, tentamos reconstruir a ESTRUTURA DE TABELA da ficha
// (colunas de exercício / séries / repetições / carga / descanso) usando as
// coordenadas das palavras devolvidas pelo Tesseract. Quando a tabela é
// reconhecida, cada linha é reescrita no formato canônico que o parser
// entende: "Supino reto 4x10 40kg desc 90s".

export const OCR_IMAGE_EXTS = ["png", "jpg", "jpeg", "webp", "bmp", "gif"];

export function isImageFile(file: File): boolean {
  if (file.type.startsWith("image/")) return true;
  const name = file.name.toLowerCase();
  return OCR_IMAGE_EXTS.some((ext) => name.endsWith(`.${ext}`));
}

/** Pré-processa: aumenta escala e joga para tons de cinza com contraste — melhora muito o OCR. */
async function preprocess(file: File): Promise<Blob | File> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(3, Math.max(1, 1600 / Math.max(bitmap.width, 1)));
    const w = Math.round(bitmap.width * scale);
    const h = Math.round(bitmap.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, w, h);
    const img = ctx.getImageData(0, 0, w, h);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const g = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
      // contraste suave em torno de 128
      const v = Math.max(0, Math.min(255, (g - 128) * 1.35 + 128));
      d[i] = d[i + 1] = d[i + 2] = v;
    }
    ctx.putImageData(img, 0, 0);
    const blob: Blob | null = await new Promise((res) => canvas.toBlob(res, "image/png"));
    return blob ?? file;
  } catch {
    return file;
  }
}

export async function extractTextFromImage(
  file: File,
  onProgress?: (pct: number) => void,
): Promise<string> {
  const { createWorker } = await import("tesseract.js");
  const input = await preprocess(file);
  const worker = await createWorker(["por", "eng"], 1, {
    logger: (m: any) => {
      if (m?.status === "recognizing text" && typeof m.progress === "number") {
        onProgress?.(Math.round(m.progress * 100));
      }
    },
  });
  try {
    const { data } = await worker.recognize(input as any);
    const words = collectWords(data);
    const tabled = words.length ? tableTextFromWords(words) : null;
    if (tabled && tabled.trim()) return tabled;
    return cleanOcrText((data as any)?.text ?? "");
  } finally {
    await worker.terminate();
  }
}

// ---------------------------------------------------------------------------
// Reconstrução de tabela a partir das palavras + bounding boxes
// ---------------------------------------------------------------------------

type OcrWord = { text: string; x0: number; x1: number; y0: number; y1: number };

/** Percorre a árvore do resultado (blocks → paragraphs → lines → words) coletando palavras. */
function collectWords(data: any): OcrWord[] {
  const out: OcrWord[] = [];
  const push = (w: any) => {
    const t = String(w?.text ?? "").trim();
    const b = w?.bbox;
    if (!t || !b) return;
    if (typeof b.x0 !== "number" || typeof b.y0 !== "number") return;
    out.push({ text: t, x0: b.x0, x1: b.x1 ?? b.x0, y0: b.y0, y1: b.y1 ?? b.y0 });
  };
  const walk = (node: any, depth = 0) => {
    if (!node || depth > 8) return;
    if (Array.isArray(node)) {
      for (const n of node) walk(n, depth + 1);
      return;
    }
    if (node.words) walk(node.words, depth + 1);
    if (node.lines) walk(node.lines, depth + 1);
    if (node.paragraphs) walk(node.paragraphs, depth + 1);
    if (node.blocks) walk(node.blocks, depth + 1);
    if (!node.words && !node.lines && !node.paragraphs && !node.blocks && node.bbox) push(node);
  };
  try {
    if (Array.isArray(data?.words) && data.words.length) data.words.forEach(push);
    else walk(data?.blocks ?? data?.lines ?? data);
  } catch {
    /* ignora */
  }
  return out;
}

/** Agrupa palavras em linhas por sobreposição vertical. */
function groupLines(words: OcrWord[]): OcrWord[][] {
  const sorted = [...words].sort((a, b) => a.y0 - b.y0 || a.x0 - b.x0);
  const lines: OcrWord[][] = [];
  for (const w of sorted) {
    const h = Math.max(6, w.y1 - w.y0);
    const line = lines[lines.length - 1];
    if (line) {
      const ref = line[0];
      const center = (w.y0 + w.y1) / 2;
      const refCenter = (ref.y0 + ref.y1) / 2;
      if (Math.abs(center - refCenter) <= h * 0.7) {
        line.push(w);
        continue;
      }
    }
    lines.push([w]);
  }
  return lines.map((l) => l.sort((a, b) => a.x0 - b.x0));
}

type ColRole = "name" | "sets" | "reps" | "weight" | "rest" | "ignore";

const HEADER_PATTERNS: Array<{ re: RegExp; role: ColRole }> = [
  { re: /exerc|movimento|nome/i, role: "name" },
  { re: /^s[ée]r|^sets?$|^s[ée]ries?$/i, role: "sets" },
  { re: /rep|^reps?$|repeti/i, role: "reps" },
  { re: /carga|peso|^kg$|^kgs$|load/i, role: "weight" },
  { re: /desc|interv|rest|pausa/i, role: "rest" },
];

function roleFor(text: string): ColRole | null {
  for (const p of HEADER_PATTERNS) if (p.re.test(text)) return p.role;
  return null;
}

type Column = { role: ColRole; x0: number; x1: number };

/** Detecta a linha de cabeçalho da tabela e as faixas horizontais de cada coluna. */
function detectHeader(lines: OcrWord[][]): { index: number; columns: Column[] } | null {
  for (let i = 0; i < Math.min(lines.length, 12); i++) {
    const line = lines[i];
    // agrupa palavras próximas em células
    const cells = mergeCells(line);
    const roles = cells.map((c) => ({ cell: c, role: roleFor(c.text) }));
    const found = roles.filter((r) => r.role);
    const distinct = new Set(found.map((r) => r.role));
    const hasNumeric = distinct.has("sets") || distinct.has("reps") || distinct.has("weight");
    if (found.length >= 2 && hasNumeric) {
      const columns: Column[] = found.map((r) => ({
        role: r.role as ColRole,
        x0: r.cell.x0,
        x1: r.cell.x1,
      }));
      columns.sort((a, b) => a.x0 - b.x0);
      // expande as fronteiras até a metade da distância para a coluna vizinha
      for (let c = 0; c < columns.length; c++) {
        const prev = columns[c - 1];
        const next = columns[c + 1];
        const left = prev ? (prev.x1 + columns[c].x0) / 2 : -Infinity;
        const right = next ? (columns[c].x1 + next.x0) / 2 : Infinity;
        columns[c] = { role: columns[c].role, x0: left, x1: right };
      }
      return { index: i, columns };
    }
  }
  return null;
}

/** Junta palavras vizinhas (gap pequeno) numa mesma célula. */
function mergeCells(line: OcrWord[]): Array<{ text: string; x0: number; x1: number }> {
  const cells: Array<{ text: string; x0: number; x1: number }> = [];
  const avgH = line.reduce((s, w) => s + (w.y1 - w.y0), 0) / Math.max(1, line.length);
  const gapLimit = Math.max(12, avgH * 1.2);
  for (const w of line) {
    const last = cells[cells.length - 1];
    if (last && w.x0 - last.x1 <= gapLimit) {
      last.text += " " + w.text;
      last.x1 = w.x1;
    } else {
      cells.push({ text: w.text, x0: w.x0, x1: w.x1 });
    }
  }
  return cells;
}

const num = (s: string): number | null => {
  const m = s.replace(",", ".").match(/-?\d+(\.\d+)?/);
  return m ? parseFloat(m[0]) : null;
};

/**
 * Converte as palavras em texto canônico. Se houver cabeçalho de tabela,
 * cada linha vira "Nome 3x12 40kg desc 90s"; caso contrário devolve o texto
 * das linhas preservando a leitura natural.
 */
export function tableTextFromWords(words: OcrWord[]): string | null {
  const lines = groupLines(words);
  if (!lines.length) return null;
  const header = detectHeader(lines);
  if (!header) return null;

  const out: string[] = [];
  // tudo que vem antes do cabeçalho normalmente é título do treino
  for (let i = 0; i < header.index; i++) {
    const t = lines[i].map((w) => w.text).join(" ").trim();
    if (t.length > 1) out.push(t);
  }

  for (let i = header.index + 1; i < lines.length; i++) {
    const line = lines[i];
    const buckets = new Map<ColRole, string[]>();
    for (const w of line) {
      const center = (w.x0 + w.x1) / 2;
      const col = header.columns.find((c) => center >= c.x0 && center < c.x1);
      const role: ColRole = col?.role ?? "name";
      if (!buckets.has(role)) buckets.set(role, []);
      buckets.get(role)!.push(w.text);
    }
    const get = (r: ColRole) => (buckets.get(r) ?? []).join(" ").trim();
    const name = cleanCell(get("name"));
    if (!name || name.replace(/[^a-zà-ú]/gi, "").length < 3) {
      // linha sem nome legível (ex.: subtítulo) — mantém texto cru
      const raw = line.map((w) => w.text).join(" ").trim();
      if (raw.length > 1) out.push(raw);
      continue;
    }

    let setsCell = cleanCell(get("sets"));
    let repsCell = cleanCell(get("reps"));
    const weightCell = cleanCell(get("weight"));
    const restCell = cleanCell(get("rest"));

    // célula única do tipo "3x12" na coluna de séries (ou de reps)
    const combo = (setsCell + " " + repsCell).match(/(\d{1,2})\s*[xX×*]\s*(\d{1,3}(?:\s*[-–a]\s*\d{1,3})?)/);
    let sets = num(setsCell);
    let reps = repsCell.replace(/\s+/g, "");
    if (combo) {
      sets = parseInt(combo[1], 10);
      reps = combo[2].replace(/\s+/g, "").replace(/[–a]/g, "-");
    } else {
      reps = reps.replace(/[–]/g, "-").replace(/^x/i, "");
    }
    if (!sets || sets < 1 || sets > 20) sets = 3;
    if (!reps || !/\d/.test(reps)) reps = "10";

    let out_line = `${name} ${sets}x${reps}`;
    const kg = num(weightCell);
    if (kg !== null && kg > 0) out_line += ` ${kg}kg`;
    const rest = parseRest(restCell);
    if (rest !== null) out_line += ` desc ${rest}s`;
    out.push(out_line);
  }

  const text = out.join("\n").trim();
  // se quase nada virou linha de exercício, deixa o fluxo cair no texto puro
  const exerciseLines = out.filter((l) => /\d+x\d/.test(l)).length;
  return exerciseLines >= 2 ? text : null;
}

function cleanCell(s: string): string {
  return s
    .replace(/[|¦]/g, " ")
    .replace(/\s{2,}/g, " ")
    .replace(/^[-–—:.\s]+|[-–—:.\s]+$/g, "")
    .trim();
}

/** "90s", "1'30", "1:30", "90", "2 min" → segundos */
function parseRest(s: string): number | null {
  if (!s) return null;
  const t = s.toLowerCase().replace(",", ".");
  const mmss = t.match(/(\d{1,2})\s*[:'′]\s*(\d{1,2})/);
  if (mmss) return parseInt(mmss[1], 10) * 60 + parseInt(mmss[2], 10);
  const min = t.match(/(\d+(\.\d+)?)\s*(min|m\b)/);
  if (min) return Math.round(parseFloat(min[1]) * 60);
  const n = num(t);
  if (n === null) return null;
  const secs = n <= 10 ? Math.round(n * 60) : Math.round(n);
  return secs > 0 && secs <= 900 ? secs : null;
}

/** Corrige confusões clássicas do OCR em fichas de treino. */
export function cleanOcrText(raw: string): string {
  return raw
    .split(/\r?\n/)
    .map((line) => {
      const normalized = line
        .replace(/[|¦]/g, "  ")
        .replace(/(\d)\s*[*×xX]\s*(\d)/g, "$1x$2")
        .replace(/(\d)[oO](\d)/g, "$10$2")
        .replace(/(\d)\s*[kK][gG9]\b/g, "$1kg")
        .replace(/\bKg\b/gi, "kg");
      // linhas em formato de tabela separadas por | ou 2+ espaços
      const fromTable = normalizeSpacedRow(normalized);
      return (fromTable ?? normalized).replace(/\s{2,}/g, " ").trim();
    })
    .filter((l) => l.length > 1)
    .join("\n");
}

/**
 * Converte uma linha em colunas separadas por 2+ espaços/pipe no formato canônico.
 * Ex.: "Supino reto   4   10   40   90" → "Supino reto 4x10 40kg desc 90s"
 */
export function normalizeSpacedRow(line: string): string | null {
  const cells = line
    .split(/\s{2,}/)
    .map((c) => c.trim())
    .filter(Boolean);
  if (cells.length < 3) return null;
  const name = cells[0];
  if (!/[a-zà-ú]{3}/i.test(name)) return null;
  const rest = cells.slice(1);
  // as demais células precisam ser majoritariamente numéricas
  const numeric = rest.filter((c) => /^\D{0,3}\d/.test(c));
  if (numeric.length < rest.length - 1 || numeric.length < 2) return null;
  if (/\d+x\d/.test(line)) return null; // já está no formato entendido pelo parser

  const [a, b, c, d] = rest;
  const sets = num(a ?? "");
  const reps = (b ?? "").replace(/\s+/g, "").replace(/[–]/g, "-");
  if (!sets || !/\d/.test(reps)) return null;
  let out = `${name} ${sets}x${reps}`;
  const kg = num(c ?? "");
  if (kg !== null && kg > 0) out += ` ${kg}kg`;
  const restSecs = parseRest(d ?? "");
  if (restSecs !== null) out += ` desc ${restSecs}s`;
  return out;
}
