import { useState, type ReactNode } from "react";
import { Info } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export type ScoreFactor = { key: string; label: string; detail: string; impact: number };
export type IgnoredScoreFactor = { key: string; label: string; reason: string };

export type DecisionExplainerProps = {
  /** Decisão final do dia, já alinhada entre Recuperação e Sugestão. */
  decision: "treinar" | "descansar";
  /** Score autoritativo 0–100. */
  score: number | null;
  /** Rótulo do status (Excelente/Boa/Moderada/Baixa). */
  statusLabel?: string | null;
  /** Ex.: "Treino leve · ~55% da carga". */
  intensityLabel?: string | null;
  /** Frase curta explicando a decisão (headline/motivo do card). */
  summary?: string | null;
  factors?: ScoreFactor[];
  ignoredFactors?: IgnoredScoreFactor[];
  /** Bloco livre extra (ex.: chips do check-in do dia). */
  extra?: ReactNode;
  /** Texto do rodapé indicando a origem da decisão. */
  origin?: string | null;
  /** Título do modal. */
  title?: string;
  className?: string;
};

/**
 * Botão de informação que abre um modal explicando POR QUE a decisão do dia foi
 * "treinar" ou "descansar" e quais fatores entraram no score 0–100.
 * Usado nos cards de Recuperação e de Sugestão de hoje para que ambos exibam a
 * mesma justificativa.
 */
export function DecisionExplainer({
  decision,
  score,
  statusLabel,
  intensityLabel,
  summary,
  factors = [],
  ignoredFactors = [],
  extra,
  origin,
  title = "Por que essa decisão?",
  className,
}: DecisionExplainerProps) {
  const [open, setOpen] = useState(false);
  const usados = factors.slice().sort((a, b) => b.impact - a.impact);
  const descansar = decision === "descansar";

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Entenda a decisão de hoje"
        title="Entenda a decisão de hoje"
        className={`grid size-7 place-items-center rounded-full text-muted-foreground hover:bg-secondary hover:text-foreground ${className ?? ""}`}
      >
        <Info className="size-3.5" strokeWidth={2.5} />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>
              Recuperação e Sugestão de hoje usam o mesmo score, então a decisão nunca é
              contraditória entre os dois blocos.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Decisão final */}
            <div className="rounded-lg border border-border/60 bg-secondary/40 p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Decisão de hoje
              </p>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <span
                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${
                    descansar
                      ? "bg-destructive/15 text-destructive"
                      : "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                  }`}
                >
                  {descansar ? "Descansar" : "Treinar"}
                </span>
                {score != null && (
                  <span className="inline-flex items-baseline gap-1 rounded-full bg-secondary px-2 py-0.5 text-xs font-semibold tabular-nums text-foreground">
                    {Math.round(score)}
                    <span className="opacity-60">/100</span>
                  </span>
                )}
                {statusLabel && (
                  <span className="text-xs text-muted-foreground">Recuperação {statusLabel}</span>
                )}
              </div>
              {intensityLabel && (
                <p className="mt-2 text-xs text-foreground">{intensityLabel}</p>
              )}
              {summary && <p className="mt-2 text-xs text-muted-foreground">{summary}</p>}
            </div>

            {extra}

            {/* Fatores usados */}
            {usados.length > 0 && (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Fatores que reduziram o score
                </p>
                <ul className="mt-1.5 space-y-1.5">
                  {usados.map((f) => (
                    <li key={f.key} className="flex items-start justify-between gap-2 text-[11px]">
                      <div className="min-w-0">
                        <p className="font-medium text-foreground">{f.label}</p>
                        <p className="text-muted-foreground">{f.detail}</p>
                      </div>
                      <span className="shrink-0 rounded-full bg-secondary px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-muted-foreground">
                        {f.impact > 0 ? `−${f.impact}` : "0"}
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-[10px] leading-snug text-muted-foreground">
                  O score começa em 100 e cai conforme cada fator pesa. Quanto maior o número ao
                  lado, maior o impacto daquele fator hoje.
                </p>
              </div>
            )}

            {/* Fatores ignorados */}
            {ignoredFactors.length > 0 && (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Fatores ignorados
                </p>
                <ul className="mt-1.5 space-y-1.5">
                  {ignoredFactors.map((f) => (
                    <li key={f.key} className="flex items-start justify-between gap-2 text-[11px]">
                      <div className="min-w-0">
                        <p className="font-medium text-muted-foreground line-through decoration-muted-foreground/40">
                          {f.label}
                        </p>
                        <p className="text-muted-foreground">{f.reason}</p>
                      </div>
                      <span className="shrink-0 rounded-full bg-secondary/60 px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
                        n/a
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {origin && (
              <p className="rounded-lg bg-secondary/60 px-3 py-2 text-[11px] leading-snug text-muted-foreground">
                {origin}
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
