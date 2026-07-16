import { Button } from "@/components/ui/button";
import { Sparkles, Play, RefreshCw, ClipboardCheck, HeartPulse, Moon, Flame, Battery, Activity, CalendarDays } from "lucide-react";
import type { Sugestao, Intensidade } from "@/lib/daily-suggestion";
import { MUSCLE_LABEL } from "@/lib/daily-suggestion";

const INTENSITY_STYLES: Record<Intensidade, { bar: string; badge: string; label: string }> = {
  leve: { bar: "bg-emerald-500", badge: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400", label: "Leve" },
  moderada: { bar: "bg-amber-500", badge: "bg-amber-500/15 text-amber-600 dark:text-amber-400", label: "Moderada" },
  alta: { bar: "bg-destructive", badge: "bg-destructive/15 text-destructive", label: "Alta" },
  descanso: { bar: "bg-muted-foreground", badge: "bg-muted text-muted-foreground", label: "Descanso" },
};

function scoreTone(score: number) {
  if (score >= 7) return { label: "Boa", cls: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400", bar: "bg-emerald-500" };
  if (score >= 5) return { label: "Moderada", cls: "bg-amber-500/15 text-amber-600 dark:text-amber-400", bar: "bg-amber-500" };
  return { label: "Baixa", cls: "bg-destructive/15 text-destructive", bar: "bg-destructive" };
}

function cardioTone(nivel: "baixa" | "media" | "alta") {
  if (nivel === "alta") return "bg-destructive/15 text-destructive";
  if (nivel === "media") return "bg-amber-500/15 text-amber-600 dark:text-amber-400";
  return "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400";
}

function Chip({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: string; tone?: string }) {
  return (
    <div className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ${tone ?? "bg-secondary text-foreground"}`}>
      <span className="grid size-3.5 place-items-center opacity-80">{icon}</span>
      <span className="opacity-70">{label}</span>
      <span className="font-semibold">{value}</span>
    </div>
  );
}

export function DailySuggestionCard({
  sugestao,
  onStart,
  onEditCheckin,
  workoutSugeridoId,
}: {
  sugestao: Sugestao;
  onStart: () => void;
  onEditCheckin: () => void;
  workoutSugeridoId: string | null;
}) {
  const s = INTENSITY_STYLES[sugestao.intensidade];
  const grupoLabel =
    sugestao.grupos.length > 0
      ? sugestao.grupos.map((g) => MUSCLE_LABEL[g]).join(" + ")
      : sugestao.tipo === "descanso ativo"
        ? "Descanso ativo"
        : sugestao.tipo === "mobilidade"
          ? "Mobilidade"
          : sugestao.tipo === "cardio leve"
            ? "Cardio leve"
            : "Full body";

  return (
    <div className="card-lift relative mt-3 overflow-hidden p-4 sm:p-5">
      <span className={`absolute inset-y-0 left-0 w-1 ${s.bar}`} aria-hidden />
      <div className="flex items-start gap-3 pl-2">
        <span className={`grid size-9 shrink-0 place-items-center rounded-full ${s.badge}`}>
          <Sparkles className="size-4" strokeWidth={2.5} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <p className="text-eyebrow uppercase text-muted-foreground">Sugestão de hoje</p>
              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${s.badge}`}>
                {s.label}
              </span>
            </div>
            <button
              onClick={onEditCheckin}
              className="grid size-7 place-items-center rounded-full text-muted-foreground hover:bg-secondary hover:text-foreground"
              aria-label="Refazer check-in"
              title="Refazer check-in"
            >
              <RefreshCw className="size-3.5" strokeWidth={2.5} />
            </button>
          </div>

          <p className="mt-2 font-display text-lg leading-snug text-foreground sm:text-xl">
            {grupoLabel}
          </p>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {sugestao.tipo}
          </p>

          <p className="mt-3 text-xs leading-relaxed text-foreground">{sugestao.motivo}</p>

          <details className="mt-3 group">
            <summary className="cursor-pointer list-none text-[10px] font-semibold uppercase tracking-wide text-muted-foreground hover:text-foreground">
              Como calculei (score {sugestao.score.toFixed(1)}/10)
            </summary>
            <p className="mt-2 text-[11px] text-muted-foreground">{sugestao.scoreDetalhe}</p>
            {sugestao.gruposLiberados.length > 0 && (
              <p className="mt-1 text-[11px] text-muted-foreground">
                <b>Liberados:</b>{" "}
                {sugestao.gruposLiberados.map((g) => `${MUSCLE_LABEL[g.grupo]} (${Number.isFinite(g.diasParado) ? `${g.diasParado}d` : "novo"})`).join(", ")}
              </p>
            )}
            <p className="mt-1 text-[11px] text-muted-foreground">
              <b>Cardio da semana:</b> {sugestao.cardio.sessoesIntensas} sessões intensas · {sugestao.cardio.minutos} min · nível {sugestao.cardio.nivel}
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              <b>Dias com esforço na semana:</b> {sugestao.diasEsforcoSemana}
            </p>
          </details>

          <div className="mt-4 flex flex-wrap gap-2">
            {sugestao.intensidade === "descanso" ? (
              <Button variant="outline" onClick={onStart} className="gap-2">
                <ClipboardCheck className="size-4" /> Registrar mobilidade/alongamento
              </Button>
            ) : workoutSugeridoId ? (
              <Button onClick={onStart} className="gap-2">
                <Play className="size-4 fill-current" /> Iniciar este treino
              </Button>
            ) : (
              <Button variant="outline" onClick={onStart} className="gap-2">
                <Play className="size-4" /> Escolher um treino
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
