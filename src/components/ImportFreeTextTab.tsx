import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { parseFreeTextWorkout } from "@/lib/import.functions";
import { ImportReviewSheet } from "./ImportReviewSheet";
import type { ImportedWorkoutsResponse } from "@/lib/import-schema";

const PLACEHOLDER = `Ex:
seg 08h: corrida 5km 25min FC média 155
qua: perna
- agachamento 4x10 80kg
- leg press 3x12 120kg
- cadeira extensora 3x15
sex: bike 45min 15km`;

export function ImportFreeTextTab({ userId, onDone }: { userId: string; onDone: () => void }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [parsed, setParsed] = useState<ImportedWorkoutsResponse | null>(null);
  const run = useServerFn(parseFreeTextWorkout);

  async function submit() {
    const trimmed = text.trim();
    if (trimmed.length < 3) {
      toast.error("Cole ou escreva um treino antes de continuar.");
      return;
    }
    setBusy(true);
    try {
      const result = await run({ data: { text: trimmed } });
      setParsed(result);
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao interpretar texto.");
    } finally {
      setBusy(false);
    }
  }

  if (parsed) {
    return (
      <ImportReviewSheet
        userId={userId}
        parsed={parsed}
        importSource="text"
        onSaved={onDone}
        onCancel={() => setParsed(null)}
      />
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Cole o treino em texto livre (planilha, WhatsApp do personal, anotação). A IA separa por dia e exercício.
      </p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={PLACEHOLDER}
        rows={8}
        maxLength={20_000}
        className="w-full resize-y rounded-lg border border-border bg-card p-3 text-sm outline-none focus:border-primary"
        disabled={busy}
      />
      <div className="flex justify-between text-[11px] text-muted-foreground">
        <span>{text.length}/20.000</span>
        <span>A IA pode errar — revise antes de salvar.</span>
      </div>
      <Button onClick={submit} disabled={busy || text.trim().length < 3} className="w-full">
        {busy ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
        Interpretar com IA
      </Button>
    </div>
  );
}
