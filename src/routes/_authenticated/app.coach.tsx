import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { askCoach } from "@/lib/coach.functions";
import { Button } from "@/components/ui/button";
import { Sparkles, Send, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/app/coach")({
  component: CoachPage,
});

const suggestions = [
  "Como devo descansar entre séries se meu objetivo é hipertrofia?",
  "Fiz um treino de perna pesado ontem. O que faço amanhã?",
  "Uso anabolizantes. Como estruturar minha semana?",
  "Estou estagnado no supino em 80kg. Como progredir?",
  "Tenho 4 dias por semana. Como dividir o treino?",
];

function CoachPage() {
  const ask = useServerFn(askCoach);
  const [q, setQ] = useState("");
  const [history, setHistory] = useState<{ q: string; a: string }[]>([]);

  const m = useMutation({
    mutationFn: async (question: string) => ask({ data: { question } }),
    onSuccess: (res, question) => {
      setHistory((h) => [{ q: question, a: res.answer }, ...h]);
      setQ("");
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao consultar o coach"),
  });


  function submit(text: string) {
    const question = text.trim();
    if (!question || m.isPending) return;
    m.mutate(question);
  }

  return (
    <div className="app-container pt-8">
      <div className="flex items-center gap-3">
        <div className="grid size-11 place-items-center rounded-xl bg-accent text-accent-foreground">
          <Sparkles className="size-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Coach de IA</h1>
          <p className="text-xs text-muted-foreground">Baseado no seu perfil e histórico</p>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="ml-auto"
          onClick={() => test.mutate()}
          disabled={test.isPending}
        >
          {test.isPending ? <Loader2 className="size-4 animate-spin" /> : "Testar Gemini"}
        </Button>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        {suggestions.map((s) => (
          <button
            key={s}
            onClick={() => submit(s)}
            disabled={m.isPending}
            className="rounded-full border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground hover:bg-secondary disabled:opacity-50"
          >
            {s}
          </button>
        ))}
      </div>

      <form
        onSubmit={(e) => { e.preventDefault(); submit(q); }}
        className="card-soft mt-5 flex items-end gap-2 p-2"
      >
        <textarea
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Pergunte algo sobre seu treino..."
          rows={2}
          className="min-h-10 flex-1 resize-none bg-transparent px-2 py-1.5 text-sm outline-none placeholder:text-muted-foreground"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(q); }
          }}
        />
        <Button type="submit" size="icon" disabled={m.isPending || !q.trim()}>
          {m.isPending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
        </Button>
      </form>

      <div className="mt-6 space-y-4">
        {m.isPending && (
          <div className="card-soft p-4 text-sm text-muted-foreground">
            <Loader2 className="inline size-4 animate-spin" /> Pensando...
          </div>
        )}
        {history.map((h, i) => (
          <div key={i} className="space-y-2">
            <div className="ml-auto max-w-[85%] rounded-2xl rounded-br-md bg-primary px-4 py-2.5 text-sm text-primary-foreground">
              {h.q}
            </div>
            <div className="card-soft max-w-[95%] whitespace-pre-wrap p-4 text-sm leading-relaxed">
              {h.a}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
