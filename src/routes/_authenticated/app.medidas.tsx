import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Route as AuthedRoute } from "./route";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState } from "@/components/EmptyState";
import { ListSkeleton } from "@/components/LoadingState";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ArrowLeft,
  Camera,
  Loader2,
  Ruler,
  Trash2,
  Save,
  ImageOff,
  Pencil,
  X,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

export const Route = createFileRoute("/_authenticated/app/medidas")({
  component: MeasurementsPage,
  errorComponent: MeasurementsError,
  head: () => ({
    meta: [
      { title: "Medidas e fotos de progresso · Carga" },
      {
        name: "description",
        content:
          "Registre peso corporal, medidas e fotos de progresso e acompanhe a evolução em gráficos.",
      },
      { property: "og:title", content: "Medidas e fotos de progresso · Carga" },
      {
        property: "og:description",
        content: "Peso, medidas corporais e galeria de fotos comparáveis lado a lado.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const FIELDS = [
  { key: "weight_kg", label: "Peso", unit: "kg" },
  { key: "body_fat_pct", label: "Gordura", unit: "%" },
  { key: "neck_cm", label: "Pescoço", unit: "cm" },
  { key: "shoulder_cm", label: "Ombros", unit: "cm" },
  { key: "chest_cm", label: "Peito", unit: "cm" },
  { key: "arm_cm", label: "Braço", unit: "cm" },
  { key: "forearm_cm", label: "Antebraço", unit: "cm" },
  { key: "waist_cm", label: "Cintura", unit: "cm" },
  { key: "hip_cm", label: "Quadril", unit: "cm" },
  { key: "thigh_cm", label: "Coxa", unit: "cm" },
  { key: "calf_cm", label: "Panturrilha", unit: "cm" },
] as const;

type FieldKey = (typeof FIELDS)[number]["key"];
type Measurement = Record<string, any> & { id: string; log_date: string };

const todayISO = () => format(new Date(), "yyyy-MM-dd");

function MeasurementsError() {
  return (
    <div className="mx-auto max-w-3xl px-4 pb-28 pt-6">
      <div className="mb-5 flex items-center gap-3">
        <Link
          to="/app/perfil"
          className="rounded-full border border-border p-2 hover:bg-muted"
          aria-label="Voltar"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <h1 className="font-display text-2xl font-bold">Medidas e fotos</h1>
      </div>
      <EmptyState
        icon={Ruler}
        title="Não consegui abrir esta página"
        message="Tente novamente em instantes. Seus dados continuam salvos."
        action={
          <Button onClick={() => window.location.reload()}>Tentar de novo</Button>
        }
      />
    </div>
  );
}

function MeasurementsPage() {
  const { user } = AuthedRoute.useRouteContext();
  const qc = useQueryClient();
  const [tab, setTab] = useState<"medidas" | "fotos">("medidas");


  return (
    <div className="mx-auto max-w-3xl px-4 pb-28 pt-6">
      <div className="mb-5 flex items-center gap-3">
        <Link
          to="/app/perfil"
          className="rounded-full border border-border p-2 hover:bg-muted"
          aria-label="Voltar"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="font-display text-2xl font-bold">Medidas e fotos</h1>
          <p className="text-sm text-muted-foreground">
            Peso corporal, medidas e evolução visual ao longo do tempo.
          </p>
        </div>
      </div>

      <div className="mb-4 inline-flex rounded-full border border-border bg-card p-1">
        {(["medidas", "fotos"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${
              tab === t ? "bg-primary text-primary-foreground" : "text-muted-foreground"
            }`}
          >
            {t === "medidas" ? "Medidas" : "Fotos"}
          </button>
        ))}
      </div>

      {tab === "medidas" ? (
        <MeasurementsTab userId={user.id} qc={qc} />
      ) : (
        <PhotosTab userId={user.id} qc={qc} />
      )}
    </div>
  );
}

function MeasurementsTab({ userId, qc }: { userId: string; qc: ReturnType<typeof useQueryClient> }) {
  const [date, setDate] = useState(todayISO());
  const [values, setValues] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState("");
  const [metric, setMetric] = useState<FieldKey>("weight_kg");
  const [editingId, setEditingId] = useState<string | null>(null);
  const formRef = useRef<HTMLElement>(null);

  const { data: rows = [], isLoading, error } = useQuery({
    queryKey: ["body-measurements", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("body_measurements")
        .select("*")
        .eq("user_id", userId)
        .order("log_date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Measurement[];
    },
  });

  const resetForm = () => {
    setEditingId(null);
    setValues({});
    setNotes("");
    setDate(todayISO());
  };

  const startEdit = (r: Measurement) => {
    setEditingId(r.id);
    setDate(r.log_date);
    setNotes(r.notes ?? "");
    const next: Record<string, string> = {};
    for (const f of FIELDS) {
      if (r[f.key] != null) next[f.key] = String(r[f.key]).replace(".", ",");
    }
    setValues(next);
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const save = useMutation({
    mutationFn: async () => {
      const payload: Record<string, any> = { user_id: userId, log_date: date, notes: notes.trim() || null };
      let filled = 0;
      for (const f of FIELDS) {
        const raw = (values[f.key] ?? "").replace(",", ".").trim();
        if (raw === "") {
          // ao editar, campo esvaziado limpa o valor salvo
          payload[f.key] = null;
          continue;
        }
        const n = Number(raw);
        if (!Number.isFinite(n) || n <= 0) throw new Error(`Valor inválido em ${f.label}.`);
        if (n > 500) throw new Error(`${f.label} parece fora do razoável.`);
        payload[f.key] = n;
        filled += 1;
      }
      if (filled === 0) throw new Error("Preencha ao menos um campo.");
      if (editingId) {
        const { error } = await supabase
          .from("body_measurements")
          .update(payload as never)
          .eq("id", editingId)
          .eq("user_id", userId);
        if (error) throw error;
        return;
      }
      const { error } = await supabase
        .from("body_measurements")
        .upsert(payload, { onConflict: "user_id,log_date" });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(editingId ? "Registro atualizado" : "Medidas salvas");
      resetForm();
      qc.invalidateQueries({ queryKey: ["body-measurements", userId] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Não consegui salvar as medidas."),
  });


  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("body_measurements").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Registro removido");
      qc.invalidateQueries({ queryKey: ["body-measurements", userId] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Não consegui remover."),
  });

  const chart = useMemo(
    () =>
      rows
        .filter((r) => r[metric] != null)
        .slice()
        .reverse()
        .map((r) => ({
          date: format(new Date(`${r.log_date}T12:00:00`), "dd/MM"),
          valor: Number(r[metric]),
        })),
    [rows, metric],
  );

  const last = rows[0];
  const prev = rows[1];

  return (
    <div className="space-y-4">
      <section ref={formRef} className="card-lift p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="font-display text-lg font-bold">
            {editingId ? "Editar registro" : "Novo registro"}
          </h2>
          {editingId && (
            <Button variant="ghost" size="sm" onClick={resetForm}>
              <X className="size-4" />
              Cancelar
            </Button>
          )}
        </div>
        <div className="mb-3">
          <Label className="text-xs">Data</Label>
          <Input type="date" value={date} max={todayISO()} onChange={(e) => setDate(e.target.value)} className="mt-1" />
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {FIELDS.map((f) => (
            <div key={f.key}>
              <Label className="text-xs">
                {f.label} ({f.unit})
              </Label>
              <Input
                inputMode="decimal"
                placeholder={last?.[f.key] != null ? String(last[f.key]) : "—"}
                value={values[f.key] ?? ""}
                onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                className="mt-1"
              />
            </div>
          ))}
        </div>
        <div className="mt-3">
          <Label className="text-xs">Observações</Label>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="Opcional: como estava se sentindo, jejum, etc."
            className="mt-1"
          />
        </div>
        <Button className="mt-3 w-full" onClick={() => save.mutate()} disabled={save.isPending}>
          {save.isPending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
          {editingId ? "Salvar alterações" : "Salvar medidas"}
        </Button>
        <p className="mt-2 text-xs text-muted-foreground">
          {editingId
            ? "Campos deixados em branco apagam o valor salvo nesse registro."
            : "Salvar na mesma data substitui o registro daquele dia."}
        </p>
      </section>


      {error ? (
        <EmptyState
          icon={Ruler}
          title="Não consegui carregar suas medidas"
          message="Verifique sua conexão e tente novamente."
        />
      ) : isLoading ? (
        <ListSkeleton rows={3} />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={Ruler}
          title="Nenhuma medida registrada"
          message="Registre seu peso e medidas para acompanhar a evolução em gráficos."
        />
      ) : (
        <>
          <section className="card-lift p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="font-display text-lg font-bold">Evolução</h2>
              <Select value={metric} onValueChange={(v) => setMetric(v as FieldKey)}>
                <SelectTrigger className="w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FIELDS.map((f) => (
                    <SelectItem key={f.key} value={f.key}>
                      {f.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {chart.length < 2 ? (
              <p className="text-sm text-muted-foreground">
                Registre pelo menos dois dias para ver o gráfico dessa medida.
              </p>
            ) : (
              <div className="h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chart} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                    <XAxis dataKey="date" fontSize={11} />
                    <YAxis fontSize={11} domain={["auto", "auto"]} />
                    <Tooltip
                      contentStyle={{
                        background: "hsl(var(--background))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                    />
                    <Line type="monotone" dataKey="valor" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
            {last && prev && (
              <p className="mt-2 text-xs text-muted-foreground">
                Última vs. anterior:{" "}
                {FIELDS.filter((f) => last[f.key] != null && prev[f.key] != null)
                  .map((f) => {
                    const d = Number(last[f.key]) - Number(prev[f.key]);
                    return `${f.label} ${d >= 0 ? "+" : ""}${(Math.round(d * 10) / 10)
                      .toString()
                      .replace(".", ",")}${f.unit}`;
                  })
                  .join(" · ") || "sem comparação disponível"}
              </p>
            )}
          </section>

          <section className="space-y-2">
            <h2 className="font-display text-lg font-bold">Histórico</h2>
            {rows.map((r) => (
              <div key={r.id} className="card-soft flex items-start justify-between gap-3 p-3">
                <div className="min-w-0">
                  <p className="font-display text-sm font-bold">
                    {format(new Date(`${r.log_date}T12:00:00`), "dd MMM yyyy", { locale: ptBR })}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {FIELDS.filter((f) => r[f.key] != null)
                      .map((f) => `${f.label} ${r[f.key]}${f.unit}`)
                      .join(" · ")}
                  </p>
                  {r.notes && <p className="mt-1 text-xs italic text-muted-foreground">{r.notes}</p>}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Remover registro"
                  onClick={() => remove.mutate(r.id)}
                  disabled={remove.isPending}
                >
                  <Trash2 className="size-4 text-muted-foreground" />
                </Button>
              </div>
            ))}
          </section>
        </>
      )}
    </div>
  );
}

type Photo = { id: string; taken_on: string; storage_path: string; note: string | null };

function PhotosTab({ userId, qc }: { userId: string; qc: ReturnType<typeof useQueryClient> }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [date, setDate] = useState(todayISO());
  const [compareA, setCompareA] = useState<string | null>(null);
  const [compareB, setCompareB] = useState<string | null>(null);

  const { data: photos = [], isLoading, error } = useQuery({
    queryKey: ["progress-photos", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("progress_photos")
        .select("id, taken_on, storage_path, note")
        .eq("user_id", userId)
        .order("taken_on", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Photo[];
    },
  });

  const { data: urls = {} } = useQuery({
    queryKey: ["progress-photo-urls", photos.map((p) => p.id).join(",")],
    enabled: photos.length > 0,
    staleTime: 45 * 60 * 1000,
    retry: 1,
    queryFn: async () => {
      const paths = photos.map((p) => p.storage_path).filter(Boolean);
      const map: Record<string, string> = {};
      if (paths.length === 0) return map;
      try {
        const { data, error } = await supabase.storage
          .from("progress-photos")
          .createSignedUrls(paths, 60 * 60);
        if (error) throw error;
        (data ?? []).forEach((d, i) => {
          if (d.signedUrl) map[paths[i]] = d.signedUrl;
        });
      } catch {
        // sem URLs assinadas a galeria ainda abre, apenas sem miniaturas
      }
      return map;
    },
  });


  const upload = useMutation({
    mutationFn: async (file: File) => {
      if (!file.type.startsWith("image/")) throw new Error("Envie um arquivo de imagem.");
      if (file.size > 8 * 1024 * 1024) throw new Error("Imagem muito grande (máx. 8 MB).");
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
      const path = `${userId}/${date}-${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("progress-photos")
        .upload(path, file, { contentType: file.type, upsert: false });
      if (upErr) throw upErr;
      const { error } = await supabase
        .from("progress_photos")
        .insert({ user_id: userId, taken_on: date, storage_path: path });
      if (error) {
        await supabase.storage.from("progress-photos").remove([path]);
        throw error;
      }
    },
    onSuccess: () => {
      toast.success("Foto adicionada");
      qc.invalidateQueries({ queryKey: ["progress-photos", userId] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Não consegui enviar a foto."),
    onSettled: () => setUploading(false),
  });

  const remove = useMutation({
    mutationFn: async (photo: Photo) => {
      const { error } = await supabase.from("progress_photos").delete().eq("id", photo.id);
      if (error) throw error;
      await supabase.storage.from("progress-photos").remove([photo.storage_path]);
    },
    onSuccess: () => {
      toast.success("Foto removida");
      setCompareA(null);
      setCompareB(null);
      qc.invalidateQueries({ queryKey: ["progress-photos", userId] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Não consegui remover a foto."),
  });

  const byId = useMemo(() => new Map(photos.map((p) => [p.id, p])), [photos]);
  const a = compareA ? byId.get(compareA) : null;
  const b = compareB ? byId.get(compareB) : null;

  const toggleCompare = (id: string) => {
    if (compareA === id) return setCompareA(null);
    if (compareB === id) return setCompareB(null);
    if (!compareA) return setCompareA(id);
    if (!compareB) return setCompareB(id);
    setCompareA(compareB);
    setCompareB(id);
  };

  return (
    <div className="space-y-4">
      <section className="card-lift p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1">
            <Label className="text-xs">Data da foto</Label>
            <Input type="date" value={date} max={todayISO()} onChange={(e) => setDate(e.target.value)} className="mt-1" />
          </div>
          <Button
            onClick={() => fileRef.current?.click()}
            disabled={uploading || upload.isPending}
          >
            {uploading || upload.isPending ? <Loader2 className="size-4 animate-spin" /> : <Camera className="size-4" />}
            Adicionar foto
          </Button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (!f) return;
            setUploading(true);
            upload.mutate(f);
          }}
        />
        <p className="mt-2 text-xs text-muted-foreground">
          As fotos ficam privadas — só você consegue visualizá-las.
        </p>
      </section>

      {a && b && (
        <section className="card-lift p-4">
          <h2 className="mb-3 font-display text-lg font-bold">Comparação</h2>
          <div className="grid grid-cols-2 gap-3">
            {[a, b].map((p) => (
              <figure key={p!.id} className="space-y-1">
                <img
                  src={urls[p!.storage_path]}
                  alt={`Foto de ${p!.taken_on}`}
                  className="aspect-[3/4] w-full rounded-xl object-cover"
                  loading="lazy"
                />
                <figcaption className="text-center text-xs text-muted-foreground">
                  {format(new Date(`${p!.taken_on}T12:00:00`), "dd MMM yyyy", { locale: ptBR })}
                </figcaption>
              </figure>
            ))}
          </div>
        </section>
      )}

      {error ? (
        <EmptyState icon={ImageOff} title="Não consegui carregar as fotos" message="Tente novamente mais tarde." />
      ) : isLoading ? (
        <ListSkeleton rows={2} />
      ) : photos.length === 0 ? (
        <EmptyState
          icon={Camera}
          title="Nenhuma foto ainda"
          message="Adicione fotos periódicas para comparar sua evolução lado a lado."
        />
      ) : (
        <section>
          <h2 className="mb-2 font-display text-lg font-bold">Galeria</h2>
          <p className="mb-3 text-xs text-muted-foreground">
            Toque em duas fotos para comparar lado a lado.
          </p>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {photos.map((p) => {
              const selected = p.id === compareA || p.id === compareB;
              return (
                <div key={p.id} className="relative">
                  <button
                    onClick={() => toggleCompare(p.id)}
                    className={`block w-full overflow-hidden rounded-xl border-2 transition ${
                      selected ? "border-primary" : "border-transparent"
                    }`}
                  >
                    {urls[p.storage_path] ? (
                      <img
                        src={urls[p.storage_path]}
                        alt={`Foto de ${p.taken_on}`}
                        className="aspect-[3/4] w-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="grid aspect-[3/4] w-full place-items-center bg-muted">
                        <Loader2 className="size-4 animate-spin text-muted-foreground" />
                      </div>
                    )}
                  </button>
                  <span className="mt-1 block text-center text-[10px] text-muted-foreground">
                    {format(new Date(`${p.taken_on}T12:00:00`), "dd/MM/yy")}
                  </span>
                  <button
                    onClick={() => remove.mutate(p)}
                    aria-label="Remover foto"
                    className="absolute right-1 top-1 rounded-full bg-background/85 p-1 text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
