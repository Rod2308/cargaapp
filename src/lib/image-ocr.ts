// OCR 100% local (tesseract.js roda no navegador). Nenhuma IA/LLM ou API externa.
// Usado para transformar uma foto/print de ficha de treino em texto bruto,
// que depois passa pelo mesmo parser por regex do "colar texto".

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
    const scale = Math.min(3, Math.max(1, 1400 / Math.max(bitmap.width, 1)));
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
    return cleanOcrText(data.text ?? "");
  } finally {
    await worker.terminate();
  }
}

/** Corrige confusões clássicas do OCR em fichas de treino. */
export function cleanOcrText(raw: string): string {
  return raw
    .split(/\r?\n/)
    .map((line) =>
      line
        .replace(/[|¦]/g, " ")
        .replace(/\s{2,}/g, " ")
        // 3X12 / 3 * 12 / 3×12 → 3x12
        .replace(/(\d)\s*[*×xX]\s*(\d)/g, "$1x$2")
        // O/o e l confundidos com dígitos dentro de números
        .replace(/(\d)[oO](\d)/g, "$10$2")
        .replace(/(\d)\s*[kK][gG9]\b/g, "$1kg")
        .replace(/\bKg\b/gi, "kg")
        .trim(),
    )
    .filter((l) => l.length > 1)
    .join("\n");
}
