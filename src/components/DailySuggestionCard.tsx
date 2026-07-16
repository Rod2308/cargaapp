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

          {/* Indicadores visuais do porquê da escolha */}
          <div className="mt-4 space-y-3 rounded-lg border border-border/60 bg-secondary/30 p-3">
            {/* Recuperação */}
            {(() => {
              const t = scoreTone(sugestao.score);
              const pct = Math.max(4, Math.min(100, sugestao.score * 10));
              return (
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      <HeartPulse className="size-3.5" /> Recuperação
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${t.cls}`}>{t.label}</span>
                      <span className="text-[11px] font-mono font-semibold tabular-nums text-foreground">{sugestao.score.toFixed(1)}/10</span>
                    </div>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
                    <div className={`h-full rounded-full ${t.bar}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })()}

            {/* Check-in — sono, dor, energia */}
            {(() => {
              const m = sugestao.scoreDetalhe.match(/Sono ([\d.]+)h · qualidade (\d)\/5 · dor (\d)\/5 · energia (\d)\/5/);
              if (!m) return null;
              const [, sono, qual, dor, energia] = m;
              const dorNum = Number(dor);
              const energiaNum = Number(energia);
              const qualNum = Number(qual);
              const sonoNum = Number(sono);
              return (
                <div>
                  <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    <ClipboardCheck className="size-3.5" /> Check-in de hoje
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <Chip
                      icon={<Moon className="size-3" />}
                      label="Sono"
                      value={`${sono}h · ${qual}/5`}
                      tone={sonoNum >= 7 && qualNum >= 4 ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" : sonoNum >= 6 ? "bg-amber-500/15 text-amber-600 dark:text-amber-400" : "bg-destructive/15 text-destructive"}
                    />
                    <Chip
                      icon={<Flame className="size-3" />}
                      label="Dor"
                      value={`${dor}/5`}
                      tone={dorNum <= 2 ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" : dorNum <= 3 ? "bg-amber-500/15 text-amber-600 dark:text-amber-400" : "bg-destructive/15 text-destructive"}
                    />
                    <Chip
                      icon={<Battery className="size-3" />}
                      label="Energia"
                      value={`${energia}/5`}
                      tone={energiaNum >= 4 ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" : energiaNum >= 3 ? "bg-amber-500/15 text-amber-600 dark:text-amber-400" : "bg-destructive/15 text-destructive"}
                    />
                  </div>
                </div>
              );
            })()}

            {/* Grupos parados / liberados */}
            {sugestao.gruposLiberados.length > 0 && (
              <div>
                <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  <Activity className="size-3.5" /> Grupos recuperados
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {sugestao.gruposLiberados.map((g) => {
                    const novo = !Number.isFinite(g.diasParado);
                    const dias = g.diasParado;
                    const tone = novo
                      ? "bg-secondary text-foreground"
                      : dias >= 4
                        ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                        : "bg-amber-500/15 text-amber-600 dark:text-amber-400";
                    return (
                      <span key={g.grupo} className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${tone}`}>
                        {MUSCLE_LABEL[g.grupo]}
                        <span className="opacity-70">· {novo ? "novo" : `${dias}d`}</span>
                      </span>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Carga semanal */}
            <div className="flex flex-wrap gap-1.5">
              <Chip
                icon={<Activity className="size-3" />}
                label="Cardio semana"
                value={`${sugestao.cardio.sessoesIntensas} intensas · ${sugestao.cardio.minutos}min`}
                tone={cardioTone(sugestao.cardio.nivel)}
              />
              <Chip
                icon={<CalendarDays className="size-3" />}
                label="Dias c/ esforço"
                value={`${sugestao.diasEsforcoSemana}/7`}
                tone={sugestao.diasEsforcoSemana >= 6 ? "bg-destructive/15 text-destructive" : sugestao.diasEsforcoSemana >= 4 ? "bg-amber-500/15 text-amber-600 dark:text-amber-400" : "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"}
              />
            </div>
          </div>


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
