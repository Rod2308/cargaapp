import { useMemo, useState } from "react";
import { format, subDays, isAfter, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Sparkles,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  Scale,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  CartesianGrid,
  Dot,
} from "recharts";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";

export interface MeasurementRecord {
  id: string;
  log_date: string;
  weight_kg?: number | null;
  body_fat_pct?: number | null;
  neck_cm?: number | null;
  shoulder_cm?: number | null;
  chest_cm?: number | null;
  arm_cm?: number | null;
  forearm_cm?: number | null;
  waist_cm?: number | null;
  hip_cm?: number | null;
  thigh_cm?: number | null;
  calf_cm?: number | null;
  notes?: string | null;
  [key: string]: any;
}

export type PeriodFilter = "7D" | "30D" | "3M" | "6M" | "1A" | "all";

export interface MetricDefinition {
  key: string;
  label: string;
  unit: string;
  category: "geral" | "tronco" | "membros";
  isCalculated?: boolean;
}

export const METRIC_DEFINITIONS: MetricDefinition[] = [
  { key: "weight_kg", label: "Peso", unit: "kg", category: "geral" },
  { key: "body_fat_pct", label: "Gordura corporal", unit: "%", category: "geral" },
  { key: "imc", label: "IMC", unit: "kg/m²", category: "geral", isCalculated: true },
  { key: "neck_cm", label: "Pescoço", unit: "cm", category: "tronco" },
  { key: "shoulder_cm", label: "Ombros", unit: "cm", category: "tronco" },
  { key: "chest_cm", label: "Tórax / Peito", unit: "cm", category: "tronco" },
  { key: "waist_cm", label: "Cintura", unit: "cm", category: "tronco" },
  { key: "hip_cm", label: "Quadril", unit: "cm", category: "tronco" },
  { key: "arm_cm", label: "Braço", unit: "cm", category: "membros" },
  { key: "forearm_cm", label: "Antebraço", unit: "cm", category: "membros" },
  { key: "thigh_cm", label: "Coxa", unit: "cm", category: "membros" },
  { key: "calf_cm", label: "Panturrilha", unit: "cm", category: "membros" },
];

/**
 * Formata números no padrão pt-BR (vírgula como decimal)
 */
export function formatPtBrNumber(val: number | null | undefined, decimals = 1): string {
  if (val == null || !Number.isFinite(val)) return "—";
  return val.toLocaleString("pt-BR", {
    minimumFractionDigits: Number.isInteger(val) ? 0 : 1,
    maximumFractionDigits: decimals,
  });
}

/**
 * Formata variação com sinal e unidade
 */
export function formatDelta(val: number | null | undefined, unit: string): string {
  if (val == null || !Number.isFinite(val)) return "—";
  const absFormatted = Math.abs(val).toLocaleString("pt-BR", {
    minimumFractionDigits: Number.isInteger(val) ? 0 : 1,
    maximumFractionDigits: 1,
  });
  if (val > 0) return `↑ +${absFormatted} ${unit === "%" ? "p.p." : unit}`;
  if (val < 0) return `↓ -${absFormatted} ${unit === "%" ? "p.p." : unit}`;
  return `0 ${unit === "%" ? "p.p." : unit}`;
}

type Props = {
  records: MeasurementRecord[];
  userHeightCm?: number | null;
  activeMetric: string;
  onChangeMetric: (metricKey: string) => void;
};

export function BodyEvolutionChart({
  records,
  userHeightCm,
  activeMetric,
  onChangeMetric,
}: Props) {
  const [period, setPeriod] = useState<PeriodFilter>("all");
  const [compareEnabled, setCompareEnabled] = useState(false);
  const [compareMetric, setCompareMetric] = useState<string | null>(null);

  // Métrica ativa atual
  const currentMetricDef = useMemo(
    () => METRIC_DEFINITIONS.find((m) => m.key === activeMetric) || METRIC_DEFINITIONS[0],
    [activeMetric]
  );

  // Métrica secundária para comparação
  const compareMetricDef = useMemo(() => {
    if (!compareEnabled || !compareMetric) return null;
    const def = METRIC_DEFINITIONS.find((m) => m.key === compareMetric);
    // Só permite comparação se a unidade for idêntica (ex: cm com cm, kg com kg)
    if (def && def.unit === currentMetricDef.unit && def.key !== currentMetricDef.key) {
      return def;
    }
    return null;
  }, [compareEnabled, compareMetric, currentMetricDef]);

  // Lista de métricas compatíveis para o seletor de comparação
  const compatibleCompareMetrics = useMemo(() => {
    return METRIC_DEFINITIONS.filter(
      (m) => m.unit === currentMetricDef.unit && m.key !== currentMetricDef.key
    );
  }, [currentMetricDef]);

  // Helper para extrair valor numérico considerando cálculo de IMC se aplicável
  const getValue = (r: MeasurementRecord, key: string): number | null => {
    if (key === "imc") {
      if (!userHeightCm || userHeightCm <= 0 || r.weight_kg == null) return null;
      const heightM = userHeightCm / 100;
      const imc = r.weight_kg / (heightM * heightM);
      return Math.round(imc * 10) / 10;
    }
    const raw = r[key];
    if (raw == null || raw === "" || !Number.isFinite(Number(raw))) return null;
    return Number(raw);
  };

  // 1. Filtro de Período e ordenação cronológica (mais antigo -> mais recente)
  const filteredRecords = useMemo(() => {
    const sorted = [...records].sort(
      (a, b) => new Date(`${a.log_date}T12:00:00`).getTime() - new Date(`${b.log_date}T12:00:00`).getTime()
    );

    if (period === "all") return sorted;

    const now = new Date();
    let cutoff: Date;
    if (period === "7D") cutoff = subDays(now, 7);
    else if (period === "30D") cutoff = subDays(now, 30);
    else if (period === "3M") cutoff = subDays(now, 90);
    else if (period === "6M") cutoff = subDays(now, 180);
    else if (period === "1A") cutoff = subDays(now, 365);
    else cutoff = subDays(now, 30);

    return sorted.filter((r) => isAfter(parseISO(`${r.log_date}T23:59:59`), cutoff));
  }, [records, period]);

  // 2. Pontos da série cronológica
  const seriesData = useMemo(() => {
    return filteredRecords
      .map((r) => {
        const val1 = getValue(r, currentMetricDef.key);
        const val2 = compareMetricDef ? getValue(r, compareMetricDef.key) : null;
        return {
          id: r.id,
          rawDate: r.log_date,
          dateLabel: format(parseISO(`${r.log_date}T12:00:00`), "dd/MM"),
          fullDate: format(parseISO(`${r.log_date}T12:00:00`), "dd 'de' MMMM 'de' yyyy", { locale: ptBR }),
          shortDate: format(parseISO(`${r.log_date}T12:00:00`), "dd MMM yyyy", { locale: ptBR }),
          val1: val1,
          val2: val2,
          notes: r.notes || null,
        };
      })
      .filter((p) => p.val1 != null || (compareMetricDef && p.val2 != null));
  }, [filteredRecords, currentMetricDef, compareMetricDef, userHeightCm]);

  // Registros válidos da métrica principal para cálculos estatísticos
  const validMetricPoints = useMemo(() => {
    return seriesData.filter((p) => p.val1 != null) as Array<(typeof seriesData)[0] & { val1: number }>;
  }, [seriesData]);

  // 3. Cálculos de Estatística e Resumo
  const stats = useMemo(() => {
    if (validMetricPoints.length === 0) return null;

    const first = validMetricPoints[0];
    const last = validMetricPoints[validMetricPoints.length - 1];
    const prev = validMetricPoints.length > 1 ? validMetricPoints[validMetricPoints.length - 2] : null;

    const totalDiff = last.val1 - first.val1;
    const totalPct = first.val1 !== 0 ? (totalDiff / first.val1) * 100 : 0;

    const lastDiff = prev ? last.val1 - prev.val1 : null;
    const lastDiffPct = prev && prev.val1 !== 0 ? (lastDiff! / prev.val1) * 100 : null;

    // Cálculo de Tendência (Linear Slope aproximado)
    let trend: "aumento" | "reducao" | "estavel" = "estavel";
    if (validMetricPoints.length >= 2) {
      if (totalDiff > 0.3) trend = "aumento";
      else if (totalDiff < -0.3) trend = "reducao";
      else trend = "estavel";
    }

    return {
      first,
      last,
      prev,
      totalDiff,
      totalPct,
      lastDiff,
      lastDiffPct,
      trend,
    };
  }, [validMetricPoints]);

  // 4. Eixo Y Dinâmico com margem visual equilibrada
  const yDomain = useMemo(() => {
    const allValues: number[] = [];
    seriesData.forEach((p) => {
      if (p.val1 != null) allValues.push(p.val1);
      if (p.val2 != null) allValues.push(p.val2);
    });

    if (allValues.length === 0) return [0, 100];

    const min = Math.min(...allValues);
    const max = Math.max(...allValues);
    const diff = max - min;

    // Se todos os pontos forem iguais, expande +/- 5%
    if (diff === 0) {
      const pad = max === 0 ? 10 : Math.max(1, max * 0.05);
      return [Math.max(0, Math.floor(min - pad)), Math.ceil(max + pad)];
    }

    // Margem visual proporcional (cerca de 15% do range, mínimo 1 unidade)
    const padding = Math.max(0.5, diff * 0.15);
    const yMin = Math.max(0, Math.floor((min - padding) * 10) / 10);
    const yMax = Math.ceil((max + padding) * 10) / 10;

    return [yMin, yMax];
  }, [seriesData]);

  // 5. Comparação "Última vs Anterior" multi-métrica (Resumo global das medidas)
  const globalRecentComparison = useMemo(() => {
    const sortedDesc = [...records].sort(
      (a, b) => new Date(`${b.log_date}T12:00:00`).getTime() - new Date(`${a.log_date}T12:00:00`).getTime()
    );
    if (sortedDesc.length < 2) return [];

    const lastRec = sortedDesc[0];
    const prevRec = sortedDesc[1];

    const deltas: Array<{ label: string; diff: number; unit: string; key: string }> = [];

    METRIC_DEFINITIONS.forEach((m) => {
      if (m.isCalculated) return;
      const vLast = getValue(lastRec, m.key);
      const vPrev = getValue(prevRec, m.key);
      if (vLast != null && vPrev != null) {
        const diff = Math.round((vLast - vPrev) * 10) / 10;
        deltas.push({ label: m.label, diff, unit: m.unit, key: m.key });
      }
    });

    return deltas;
  }, [records]);

  // Render do Tooltip customizado elegante
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || !payload.length) return null;

    const dataPoint = payload[0]?.payload;
    if (!dataPoint) return null;

    // Busca o ponto anterior no array para calcular delta específico desta data
    const currIndex = seriesData.findIndex((p) => p.id === dataPoint.id);
    const prevPoint = currIndex > 0 ? seriesData[currIndex - 1] : null;

    const deltaVal1 =
      prevPoint && prevPoint.val1 != null && dataPoint.val1 != null
        ? Math.round((dataPoint.val1 - prevPoint.val1) * 10) / 10
        : null;

    const deltaVal2 =
      prevPoint && prevPoint.val2 != null && dataPoint.val2 != null
        ? Math.round((dataPoint.val2 - prevPoint.val2) * 10) / 10
        : null;

    return (
      <div className="rounded-xl border border-border/80 bg-background/95 p-3 shadow-lg backdrop-blur-md text-xs space-y-1.5 min-w-[170px] animate-in fade-in duration-150">
        <p className="font-semibold text-foreground border-b border-border/40 pb-1 text-[11px] uppercase tracking-wider text-muted-foreground">
          {dataPoint.shortDate}
        </p>

        {dataPoint.val1 != null && (
          <div>
            <div className="flex items-center justify-between gap-3">
              <span className="font-medium text-foreground">{currentMetricDef.label}:</span>
              <span className="font-bold text-primary text-sm">
                {formatPtBrNumber(dataPoint.val1)} {currentMetricDef.unit}
              </span>
            </div>
            {deltaVal1 !== null && (
              <p className="text-[10px] text-muted-foreground mt-0.5 flex items-center justify-end gap-1">
                <span>{formatDelta(deltaVal1, currentMetricDef.unit)}</span>
                <span className="opacity-70">vs medição anterior</span>
              </p>
            )}
          </div>
        )}

        {compareMetricDef && dataPoint.val2 != null && (
          <div className="pt-1.5 border-t border-border/40">
            <div className="flex items-center justify-between gap-3">
              <span className="font-medium text-purple-600 dark:text-purple-400">{compareMetricDef.label}:</span>
              <span className="font-bold text-purple-600 dark:text-purple-400 text-sm">
                {formatPtBrNumber(dataPoint.val2)} {compareMetricDef.unit}
              </span>
            </div>
            {deltaVal2 !== null && (
              <p className="text-[10px] text-muted-foreground mt-0.5 flex items-center justify-end gap-1">
                <span>{formatDelta(deltaVal2, compareMetricDef.unit)}</span>
                <span className="opacity-70">vs medição anterior</span>
              </p>
            )}
          </div>
        )}

        {dataPoint.notes && (
          <p className="pt-1 text-[10px] italic text-muted-foreground border-t border-border/40">
            &ldquo;{dataPoint.notes}&rdquo;
          </p>
        )}
      </div>
    );
  };

  // Custom Dot para destacar o último ponto registrado
  const RenderCustomDot = (props: any) => {
    const { cx, cy, index, payload, stroke } = props;
    if (cx == null || cy == null) return null;
    const isLast = index === seriesData.length - 1;

    if (isLast) {
      return (
        <g key={`dot-${index}`}>
          <circle cx={cx} cy={cy} r={6} fill={stroke} fillOpacity={0.25} />
          <circle cx={cx} cy={cy} r={4} fill={stroke} stroke="#ffffff" strokeWidth={1.5} />
        </g>
      );
    }

    return (
      <circle
        key={`dot-${index}`}
        cx={cx}
        cy={cy}
        r={3}
        fill={stroke}
        stroke="#ffffff"
        strokeWidth={1}
      />
    );
  };

  return (
    <section className="card-lift p-4 sm:p-5 space-y-4">
      {/* Header do Card: Título + Seletor de Medida */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-display text-lg font-bold text-foreground flex items-center gap-2">
            <span>Evolução</span>
            {stats && stats.trend !== "estavel" && (
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                  stats.trend === "aumento"
                    ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                    : "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                }`}
              >
                {stats.trend === "aumento" ? (
                  <>
                    <TrendingUp className="size-3" /> Tendência de aumento
                  </>
                ) : (
                  <>
                    <TrendingDown className="size-3" /> Tendência de redução
                  </>
                )}
              </span>
            )}
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Acompanhe o histórico longitudinal das suas medidas corporais.
          </p>
        </div>

        {/* Seletor de Métrica Principal */}
        <div className="flex items-center gap-2">
          <Select value={activeMetric} onValueChange={onChangeMetric}>
            <SelectTrigger className="w-full sm:w-48 text-xs font-semibold bg-background">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="max-h-80">
              <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Geral
              </div>
              {METRIC_DEFINITIONS.filter((m) => m.category === "geral").map((m) => (
                <SelectItem key={m.key} value={m.key} className="text-xs font-medium">
                  {m.label} ({m.unit})
                </SelectItem>
              ))}

              <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground mt-1 border-t">
                Tronco
              </div>
              {METRIC_DEFINITIONS.filter((m) => m.category === "tronco").map((m) => (
                <SelectItem key={m.key} value={m.key} className="text-xs font-medium">
                  {m.label} ({m.unit})
                </SelectItem>
              ))}

              <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground mt-1 border-t">
                Membros
              </div>
              {METRIC_DEFINITIONS.filter((m) => m.category === "membros").map((m) => (
                <SelectItem key={m.key} value={m.key} className="text-xs font-medium">
                  {m.label} ({m.unit})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Barra de Filtro de Período & Botão Comparar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-y border-border/50 py-2.5">
        {/* Seletor Compacto de Período */}
        <div className="inline-flex rounded-lg bg-muted/60 p-0.5 text-xs font-medium">
          {(["7D", "30D", "3M", "6M", "1A", "all"] as PeriodFilter[]).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPeriod(p)}
              className={`rounded-md px-2.5 py-1 transition-all ${
                period === p
                  ? "bg-background text-foreground font-bold shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {p === "all" ? "Tudo" : p}
            </button>
          ))}
        </div>

        {/* Toggle Comparar */}
        {compatibleCompareMetrics.length > 0 && (
          <div className="flex items-center gap-2">
            {!compareEnabled ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setCompareEnabled(true);
                  if (!compareMetric && compatibleCompareMetrics[0]) {
                    setCompareMetric(compatibleCompareMetrics[0].key);
                  }
                }}
                className="h-8 gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
              >
                <Layers className="size-3.5" />
                <span>Comparar</span>
              </Button>
            ) : (
              <div className="flex items-center gap-1.5 animate-in fade-in duration-150">
                <Select
                  value={compareMetric || compatibleCompareMetrics[0]?.key}
                  onValueChange={setCompareMetric}
                >
                  <SelectTrigger className="h-8 w-36 text-xs bg-background border-purple-500/40 text-purple-700 dark:text-purple-300">
                    <SelectValue placeholder="Comparar com..." />
                  </SelectTrigger>
                  <SelectContent>
                    {compatibleCompareMetrics.map((m) => (
                      <SelectItem key={m.key} value={m.key} className="text-xs">
                        + {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setCompareEnabled(false)}
                  className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground"
                >
                  ✕
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ÁREA DO GRÁFICO */}
      {seriesData.length === 0 ? (
        <div className="py-12 text-center text-xs text-muted-foreground border border-dashed rounded-xl p-6">
          <Scale className="size-8 mx-auto mb-2 opacity-40" />
          <p className="font-semibold text-foreground">Sem registros no período selecionado.</p>
          <p className="mt-1 text-[11px]">Tente mudar o período para "Tudo" ou adicione novas medições.</p>
        </div>
      ) : (
        <div>
          {/* Legenda visual quando houver comparação ativa */}
          {compareMetricDef && (
            <div className="flex items-center justify-end gap-4 mb-2 text-xs">
              <div className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-full bg-primary" />
                <span className="font-medium text-foreground">{currentMetricDef.label}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-full bg-purple-500" />
                <span className="font-medium text-purple-600 dark:text-purple-400">
                  {compareMetricDef.label}
                </span>
              </div>
            </div>
          )}

          <div className="h-56 w-full -ml-2">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={seriesData} margin={{ top: 10, right: 15, left: -10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.15} />
                <XAxis
                  dataKey="dateLabel"
                  fontSize={11}
                  tickLine={false}
                  axisLine={{ strokeOpacity: 0.2 }}
                  tick={{ fill: "currentColor" }}
                  className="text-muted-foreground"
                />
                <YAxis
                  fontSize={11}
                  domain={yDomain}
                  tickLine={false}
                  axisLine={{ strokeOpacity: 0.2 }}
                  tick={{ fill: "currentColor" }}
                  className="text-muted-foreground"
                  tickFormatter={(v) => formatPtBrNumber(v)}
                />
                <RechartsTooltip content={<CustomTooltip />} />

                {/* Linha Principal */}
                <Line
                  type="monotone"
                  dataKey="val1"
                  name={currentMetricDef.label}
                  stroke="hsl(var(--primary))"
                  strokeWidth={2.5}
                  connectNulls={true}
                  dot={<RenderCustomDot stroke="hsl(var(--primary))" />}
                  activeDot={{ r: 6, stroke: "#ffffff", strokeWidth: 2 }}
                />

                {/* Linha Secundária Comparativa (se ativada) */}
                {compareMetricDef && (
                  <Line
                    type="monotone"
                    dataKey="val2"
                    name={compareMetricDef.label}
                    stroke="#a855f7"
                    strokeWidth={2}
                    strokeDasharray="4 4"
                    connectNulls={true}
                    dot={<RenderCustomDot stroke="#a855f7" />}
                    activeDot={{ r: 6, stroke: "#ffffff", strokeWidth: 2 }}
                  />
                )}
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Mensagem discreta quando há apenas 1 medição */}
          {seriesData.length === 1 && (
            <p className="mt-2 text-center text-xs text-muted-foreground bg-muted/30 py-2 rounded-lg">
              ✨ Adicione uma nova medição para começar a acompanhar sua evolução.
            </p>
          )}
        </div>
      )}

      {/* 7. RESUMO DA EVOLUÇÃO (Primeiro vs Atual no período) */}
      {stats && (
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4 rounded-xl border border-border/60 bg-card/40 p-3">
          <div className="space-y-0.5">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Primeiro ({stats.first.dateLabel})
            </span>
            <p className="font-display text-base font-bold text-foreground">
              {formatPtBrNumber(stats.first.val1)} {currentMetricDef.unit}
            </p>
          </div>

          <div className="space-y-0.5">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Atual ({stats.last.dateLabel})
            </span>
            <p className="font-display text-base font-bold text-primary">
              {formatPtBrNumber(stats.last.val1)} {currentMetricDef.unit}
            </p>
          </div>

          <div className="space-y-0.5">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Variação Absoluta
            </span>
            <p
              className={`font-display text-base font-bold flex items-center gap-0.5 ${
                stats.totalDiff > 0
                  ? "text-amber-600 dark:text-amber-400"
                  : stats.totalDiff < 0
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-foreground"
              }`}
            >
              {stats.totalDiff > 0 ? (
                <ArrowUpRight className="size-4 shrink-0" />
              ) : stats.totalDiff < 0 ? (
                <ArrowDownRight className="size-4 shrink-0" />
              ) : (
                <Minus className="size-4 shrink-0" />
              )}
              <span>{formatDelta(stats.totalDiff, currentMetricDef.unit)}</span>
            </p>
          </div>

          <div className="space-y-0.5">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Variação %
            </span>
            <p
              className={`font-display text-base font-bold ${
                stats.totalPct > 0
                  ? "text-amber-600 dark:text-amber-400"
                  : stats.totalPct < 0
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-foreground"
              }`}
            >
              {stats.totalPct > 0 ? "+" : ""}
              {formatPtBrNumber(stats.totalPct, 2)}%
            </p>
          </div>
        </div>
      )}

      {/* 8. COMPARAÇÃO COM A MEDIÇÃO ANTERIOR (Indicadores Visuais) */}
      {globalRecentComparison.length > 0 && (
        <div className="pt-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground mb-2">
            <Sparkles className="size-3.5 text-brand" />
            <span>Desde a última medição:</span>
          </div>

          <div className="flex flex-wrap gap-2">
            {globalRecentComparison.map((item) => {
              const isZero = item.diff === 0;
              const isUp = item.diff > 0;
              return (
                <div
                  key={item.key}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs border font-medium transition-colors ${
                    item.key === activeMetric
                      ? "bg-primary/10 border-primary/40 text-foreground"
                      : "bg-secondary/40 border-border/50 text-muted-foreground"
                  }`}
                >
                  <span className="font-semibold text-foreground">{item.label}</span>
                  <span
                    className={`font-bold flex items-center ${
                      isUp
                        ? "text-amber-600 dark:text-amber-400"
                        : !isZero
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-muted-foreground"
                    }`}
                  >
                    {isUp ? "↑ +" : !isZero ? "↓ " : ""}
                    {formatPtBrNumber(Math.abs(item.diff))} {item.unit === "%" ? "p.p." : item.unit}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}
