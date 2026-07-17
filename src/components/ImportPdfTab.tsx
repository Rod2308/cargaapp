import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, FileText } from "lucide-react";
import { toast } from "sonner";
import { parsePdfWorkout } from "@/lib/import.functions";
import { extractPdfPages } from "@/lib/pdf-extract";
import { ImportReviewSheet } from "./ImportReviewSheet";
import type { ImportedWorkoutsResponse } from "@/lib/import-schema";

const MAX_MB = 20;

export function ImportPdfTab({ userId, onDone }: { userId: string; onDone: () => void }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [parsed, setParsed] = useState<ImportedWorkoutsResponse | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const run = useServerFn(parsePdfWorkout);

  async function handleFile(file: File) {
    if (!file.name.toLowerCase().endsWith(".pdf") && file.type !== "application/pdf") {
      toast.error("Envie um arquivo PDF.");
      return;
    }
    if (file.size > MAX_MB * 1024 * 1024) {
      toast.error(`PDF maior que ${MAX_MB}MB.`);
      return;
    }
    setFileName(file.name);
    setBusy("Extraindo páginas do PDF…");
    try {
      const pages = await extractPdfPages(file);
      setBusy("Interpretando com IA…");
      const result = await run({ data: { pages } });
      setParsed(result);
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao processar PDF.");
    } finally {
      setBusy(null);
    }
  }

  if (parsed) {
    return (
      <ImportReviewSheet
        userId={userId}
        parsed={parsed}
        importSource={`pdf:${fileName ?? "arquivo.pdf"}`}
        onSaved={onDone}
        onCancel={() => setParsed(null)}
      />
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Envie uma planilha de treino, prescrição do personal ou relatório em PDF. Funciona com PDFs de texto ou
        escaneados (OCR via IA).
      </p>
      <label
        className={`flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-border p-8 text-center transition-colors hover:border-primary/50 ${
          busy ? "pointer-events-none opacity-60" : ""
        }`}
      >
        {busy ? <Loader2 className="size-8 animate-spin text-primary" /> : <FileText className="size-8 text-muted-foreground" />}
        <p className="text-sm font-medium">{busy ?? "Escolha um PDF"}</p>
        <p className="text-xs text-muted-foreground">PDF · até {MAX_MB}MB · máx. 20 páginas</p>
        <input
          type="file"
          accept="application/pdf,.pdf"
          className="hidden"
          disabled={!!busy}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void handleFile(f);
          }}
        />
      </label>
      <p className="text-[11px] text-muted-foreground">A leitura por IA pode conter erros — confira antes de salvar.</p>
    </div>
  );
}
