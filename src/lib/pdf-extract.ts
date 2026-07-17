// Cliente-side: extrai texto e imagens de páginas de PDF usando pdfjs-dist.
// Retorna páginas com texto quando o PDF tem camada de texto, ou imagem PNG base64
// (para OCR/visão) quando é um PDF escaneado.

import type { PDFDocumentProxy } from "pdfjs-dist";

const MAX_PAGES = 20;
const MIN_CHARS_FOR_TEXT_MODE = 40;

export type PdfPage = { text?: string; imageBase64?: string };

let workerConfigured = false;
async function loadPdfJs() {
  const pdfjs = await import("pdfjs-dist");
  if (!workerConfigured) {
    // Usa o worker via URL do módulo — evita bundling manual.
    const worker = await import("pdfjs-dist/build/pdf.worker.mjs?url");
    pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
    workerConfigured = true;
  }
  return pdfjs;
}

async function renderPageToPng(doc: PDFDocumentProxy, pageNum: number): Promise<string> {
  const page = await doc.getPage(pageNum);
  const viewport = page.getViewport({ scale: 1.5 });
  const canvas = document.createElement("canvas");
  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D indisponível");
  await page.render({ canvas, canvasContext: ctx, viewport } as any).promise;
  return canvas.toDataURL("image/png").replace(/^data:image\/png;base64,/, "");
}

export async function extractPdfPages(file: File): Promise<PdfPage[]> {
  const pdfjs = await loadPdfJs();
  const buffer = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data: buffer }).promise;
  const pageCount = Math.min(doc.numPages, MAX_PAGES);
  const pages: PdfPage[] = [];

  for (let i = 1; i <= pageCount; i++) {
    const page = await doc.getPage(i);
    const textContent = await page.getTextContent();
    const text = textContent.items
      .map((item: any) => ("str" in item ? item.str : ""))
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();

    if (text.length >= MIN_CHARS_FOR_TEXT_MODE) {
      pages.push({ text });
    } else {
      const imageBase64 = await renderPageToPng(doc, i);
      pages.push({ imageBase64 });
    }
  }

  return pages;
}
