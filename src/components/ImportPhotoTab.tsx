import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Camera } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { parseImageWorkout } from "@/lib/import.functions";
import { ImportReviewSheet } from "./ImportReviewSheet";
import type { ImportedWorkoutsResponse } from "@/lib/import-schema";

const MAX_MB = 10;
const ALLOWED = ["image/jpeg", "image/png", "image/webp"];

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => {
      const s = String(fr.result);
      resolve(s.replace(/^data:[^;]+;base64,/, ""));
    };
    fr.onerror = () => reject(fr.error);
    fr.readAsDataURL(file);
  });
}

export function ImportPhotoTab({ userId, onDone }: { userId: string; onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const [parsed, setParsed] = useState<ImportedWorkoutsResponse | null>(null);
  const run = useServerFn(parseImageWorkout);

  async function handleFile(file: File) {
    if (file.name.toLowerCase().endsWith(".heic") || file.type === "image/heic") {
      toast.error("HEIC não é suportado no navegador. Converta para JPG/PNG antes de enviar.");
      return;
    }
    if (!ALLOWED.includes(file.type)) {
      toast.error("Envie uma imagem JPG, PNG ou WEBP.");
      return;
    }
    if (file.size > MAX_MB * 1024 * 1024) {
      toast.error(`Imagem maior que ${MAX_MB}MB.`);
      return;
    }
    setBusy(true);
    try {
      const base64 = await fileToBase64(file);
      const result = await run({
        data: { imageBase64: base64, mime: file.type as "image/jpeg" | "image/png" | "image/webp" },
      });
      setParsed(result);
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao interpretar imagem.");
    } finally {
      setBusy(false);
    }
  }

  if (parsed) {
    return (
      <ImportReviewSheet
        userId={userId}
        parsed={parsed}
        importSource="photo"
        onSaved={onDone}
        onCancel={() => setParsed(null)}
      />
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Envie um print de outro app (Strava, Nike Run, TrainingPeaks…) ou foto de uma ficha escrita à mão. A IA
        extrai automaticamente os dados. Você poderá revisar antes de salvar.
      </p>
      <label
        className={`flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-border p-8 text-center transition-colors hover:border-primary/50 ${
          busy ? "pointer-events-none opacity-60" : ""
        }`}
      >
        {busy ? <Loader2 className="size-8 animate-spin text-primary" /> : <Camera className="size-8 text-muted-foreground" />}
        <p className="text-sm font-medium">{busy ? "Interpretando com IA…" : "Escolha uma foto ou tire agora"}</p>
        <p className="text-xs text-muted-foreground">JPG, PNG ou WEBP · até {MAX_MB}MB</p>
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          capture="environment"
          className="hidden"
          disabled={busy}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void handleFile(f);
          }}
        />
      </label>
      <p className="text-[11px] text-muted-foreground">
        A leitura por IA pode conter erros — sempre confira os dados antes de salvar.
      </p>
    </div>
  );
}
