// Extract raw text from user-uploaded plan files.
// Supports: .txt .md .csv .json .pdf
// FIT/GPX/TCX are session recordings (not plans) — direct users to the other importer.

export async function extractTextFromFile(
  file: File,
  onProgress?: (pct: number) => void,
): Promise<string> {
  const name = file.name.toLowerCase();
  const ext = name.slice(name.lastIndexOf(".") + 1);

  const { isImageFile, extractTextFromImage } = await import("@/lib/image-ocr");
  if (isImageFile(file)) {
    const text = await extractTextFromImage(file, onProgress);
    if (!text.trim()) throw new Error("Não consegui ler texto nessa imagem. Tente uma foto mais nítida.");
    return text;
  }


  if (["fit", "gpx", "tcx"].includes(ext)) {
    throw new Error(
      "Arquivos .fit/.gpx/.tcx são treinos executados, não planos. Use 'Importar treino' no histórico.",
    );
  }

  if (["txt", "md", "csv", "json"].includes(ext)) {
    return await file.text();
  }

  if (ext === "pdf") {
    return await extractPdfText(file);
  }

  // Fallback: try as text
  try {
    return await file.text();
  } catch {
    throw new Error(`Tipo de arquivo não suportado: .${ext}`);
  }
}

async function extractPdfText(file: File): Promise<string> {
  // Dynamic import keeps pdfjs out of initial bundle
  const pdfjs: any = await import("pdfjs-dist");
  // Use a workerless setup with the bundled worker via Vite's ?url import
  try {
    const workerUrl = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
    pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  } catch {
    // If worker resolution fails, fall back to disabling the worker
    pdfjs.GlobalWorkerOptions.workerSrc = "";
  }

  const buf = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data: buf, disableWorker: !pdfjs.GlobalWorkerOptions.workerSrc }).promise;
  const parts: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    // Group items into visual lines by Y position so exercise rows stay together
    const rows = new Map<number, { x: number; str: string }[]>();
    for (const item of content.items as any[]) {
      const t = item.transform ?? [];
      const y = Math.round((t[5] ?? 0) * 10) / 10;
      const x = t[4] ?? 0;
      const arr = rows.get(y) ?? [];
      arr.push({ x, str: String(item.str ?? "") });
      rows.set(y, arr);
    }
    const ordered = [...rows.entries()]
      .sort((a, b) => b[0] - a[0])
      .map(([, items]) =>
        items
          .sort((a, b) => a.x - b.x)
          .map((it) => it.str)
          .join(" ")
          .replace(/\s+/g, " ")
          .trim(),
      )
      .filter(Boolean);
    parts.push(ordered.join("\n"));
  }
  return parts.join("\n\n");
}
