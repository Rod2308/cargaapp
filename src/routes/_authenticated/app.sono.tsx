import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Route as AuthedRoute } from "./route";
import { ListSkeleton } from "@/components/LoadingState";
import { EmptyState } from "@/components/EmptyState";
import { ArrowLeft, Moon } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { buildSleepWeeks, sleepStatus } from "@/lib/sleep-insights";
import type { SleepRow } from "@/lib/recovery-core";

export const Route = createFileRoute("/_authenticated/app/sono")({
  component: SleepPanelPage,
  head: () => ({
    meta: [
      { title: "Histórico de sono por semana · Carga" },
      {
        name: "description",
        content:
          "Veja seu sono registrado semana a semana e entenda como ele muda o score de Recuperação e a sugestão de treino do dia.",
      },
      { property: "og:title", content: "Histórico de sono por semana · Carga" },
      {
        property: "og:description",
        content: "Sono por semana e o impacto direto na Recuperação e na sugestão do dia.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const DAY = 86_400_000;
const WEEKDAYS = ["seg", "ter", "qua", "qui", "sex", "sáb", "dom"];

function SleepPanelPage() {
  const { user } = AuthedRoute.useRouteContext();
  const todayStr = format(new Date(), "yyyy-MM-dd");
  const [tab, setTab] = useState<"semanas" | "datas">("semanas");

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["sleep-history", user.id],
    staleTime: 60_000,
    queryFn: async () => {
      const since = format(new Date(Date.now() - 45 * DAY), "yyyy-MM-dd");
      const { data, error } = await supabase
        .from("sleep_logs")
        .select("log_date, hours, quality")
        .eq("user_id", user.id)
        .gte("log_date", since)
        .order("log_date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as SleepRow[];
    },
  });

  // Mesma chave do Dashboard: reaproveita o score já calculado.
  const { data: recovery } = useQuery({
    queryKey: ["recovery", user.id, todayStr],
    staleTime: 1000 * 60 * 30,
    retry: false,
    queryFn: async () => {
      const { computeRecoveryAdviceFor } = await import("@/lib/recovery-core");
      return await computeRecoveryAdviceFor(supabase, user.id);
    },
  });

  const weeks = useMemo(() => buildSleepWeeks(rows, 6), [rows]);
  const maxHours = useMemo(
    () => Math.max(9, ...rows.map((r) => Number(r.hours) || 0)),
    [rows],
  );

  const sleepFactor = recovery?.factors.find((f) => f.key === "sleep") ?? null;
  const scoreSemSono =
    recovery && sleepFactor ? Math.min(100, recovery.score + sleepFactor.impact) : null;

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-24 pt-4 sm:px-6">
      <Link
        to="/app"
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Voltar
      </Link>

      <header className="mt-3 flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-secondary">
          <Moon className="size-5" strokeWidth={2.5} />
        </span>
        <div>
          <h1 className="font-display text-xl font-black leading-tight text-foreground sm:text-2xl">
            Sono por semana
          </h1>
          <p className="mt-1 text-xs text-muted-foreground">
            Tudo vem do card &ldquo;Sono de hoje&rdquo; — a mesma fonte usada pela Recuperação e
            pela Sugestão do dia.
          </p>
        </div>
      </header>

      {/* Impacto atual */}
      <section className="card-lift mt-4 p-4 sm:p-5">
        <p className="text-eyebrow uppercase text-muted-foreground">Impacto de hoje</p>
        {recovery ? (
          <>
            <div className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="font-display text-3xl font-black tabular-nums text-foreground">
                {recovery.score}
              </span>
              <span className="text-sm text-muted-foreground">de recuperação</span>
              {sleepFactor ? (
                <span className="rounded-full bg-destructive/15 px-2 py-0.5 text-xs font-semibold text-destructive">
                  −{sleepFactor.impact} pts por sono
                </span>
              ) : (
                <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-semibold text-emerald-600">
                  sono não está penalizando
                </span>
              )}
            </div>
            {sleepFactor && (
              <p className="mt-2 text-sm text-muted-foreground">
                {sleepFactor.detail}. Sem essa penalidade o score estaria em torno de{" "}
                <span className="font-semibold text-foreground">{scoreSemSono}</span>.
              </p>
            )}
            <div className="mt-3 rounded-md border border-border bg-muted/40 p-3">
              <p className="text-xs font-semibold text-foreground">Sugestão do dia</p>
              <p className="mt-1 text-sm text-muted-foreground">{recovery.intensityLabel}</p>
              <p className="mt-1 text-xs text-muted-foreground">{recovery.recommendation}</p>
            </div>
          </>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">Calculando recuperação…</p>
        )}
      </section>

      {isLoading ? (
        <ListSkeleton />
      ) : rows.length === 0 ? (
        <EmptyState
          title="Nenhum sono registrado ainda"
          message="Registre no card “Sono de hoje” no início e este painel começa a montar seu histórico semanal."
        />
      ) : (
        <div className="mt-4 grid gap-3">
          {weeks.map((w, idx) => {
            const label =
              idx === 0
                ? "Esta semana"
                : idx === 1
                  ? "Semana passada"
                  : `${format(parseISO(w.start), "d MMM", { locale: ptBR })} – ${format(
                      parseISO(w.end),
                      "d MMM",
                      { locale: ptBR },
                    )}`;
            return (
              <section key={w.start} className="card-lift p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-display text-sm font-bold text-foreground">{label}</p>
                  <p className="text-xs text-muted-foreground">
                    {w.avgHours != null ? `média ${w.avgHours.toFixed(1)}h` : "sem registros"}
                    {w.avgQuality != null ? ` · qualidade ${w.avgQuality.toFixed(1)}/5` : ""}
                    {" · "}
                    {w.logged}/7 noites
                  </p>
                </div>

                <div className="mt-3 flex items-end gap-1.5">
                  {w.nights.map((n) => {
                    const st = sleepStatus(n.hours);
                    const pct = n.hours != null ? (n.hours / maxHours) * 100 : 6;
                    const isToday = n.date === todayStr;
                    return (
                      <div key={n.date} className="flex flex-1 flex-col items-center gap-1">
                        <span className="text-[10px] tabular-nums text-muted-foreground">
                          {n.hours != null ? n.hours : "—"}
                        </span>
                        <div className="flex h-20 w-full items-end rounded-sm bg-muted/50">
                          <div
                            className={`w-full rounded-sm ${st.bar}`}
                            style={{ height: `${Math.max(pct, 6)}%` }}
                            title={`${n.date}: ${n.hours ?? "sem registro"}`}
                          />
                        </div>
                        <span
                          className={`text-[10px] ${isToday ? "font-bold text-foreground" : "text-muted-foreground"}`}
                        >
                          {WEEKDAYS[(new Date(n.date + "T12:00:00").getDay() + 6) % 7]}
                        </span>
                      </div>
                    );
                  })}
                </div>

                <p className="mt-3 text-xs text-muted-foreground">
                  {w.penalty > 0 ? (
                    <>
                      Sono dessa semana custaria{" "}
                      <span className="font-semibold text-destructive">−{w.penalty} pts</span> de
                      recuperação
                      {w.shortNights > 0 ? ` · ${w.shortNights} noite(s) abaixo de 7h` : ""}.
                    </>
                  ) : (
                    "Sono dessa semana não penalizaria sua recuperação."
                  )}
                </p>
              </section>
            );
          })}
        </div>
      )}

      <p className="mt-6 text-center text-xs text-muted-foreground">
        O sono só é registrado no card “Sono de hoje”, no início.{" "}
        <Link to="/app" className="font-semibold text-foreground underline">
          Registrar agora
        </Link>
      </p>
    </div>
  );
}
