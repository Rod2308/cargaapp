import { useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Download, Upload, Loader2, Database, CloudDownload } from "lucide-react";
import { prefetchOfflineEssentials } from "@/lib/offline-prefetch";
import { toast } from "sonner";
import { format } from "date-fns";
import { useQueryClient } from "@tanstack/react-query";

type Fmt = "json" | "csv" | "pdf" | "txt";

type ExportPayload = {
  version: number;
  exported_at: string;
  user_id: string;
  display_name: string | null;
  workouts: Array<{
    id: string;
    label: string;
    name: string;
    notes: string | null;
    order_idx: number;
    exercises: Array<{
      exercise_name: string;
      muscle_group: string;
      order_idx: number;
      target_sets: number;
      target_reps: string;
      target_weight_kg: number | null;
      target_rest_seconds: number;
      notes: string | null;
    }>;
  }>;
  sessions: Array<{
    id: string;
    started_at: string;
    ended_at: string | null;
    workout_label: string | null;
    workout_name: string | null;
    activity_type: string | null;
    source: string;
    title: string | null;
    notes: string | null;
    perceived_effort: number | null;
    distance_m: number | null;
    avg_hr: number | null;
    max_hr: number | null;
    calories: number | null;
    sets: Array<{
      exercise_name: string;
      muscle_group: string;
      set_number: number;
      reps: number | null;
      weight_kg: number | null;
      rpe: number | null;
      completed_at: string;
    }>;
  }>;
};

async function fetchAll(userId: string): Promise<ExportPayload> {
  const [profileRes, workoutsRes, sessionsRes] = await Promise.all([
    supabase.from("profiles").select("display_name").eq("id", userId).maybeSingle(),
    supabase.from("workouts").select("id, label, name, notes, order_idx").eq("user_id", userId).order("order_idx"),
    supabase
      .from("sessions")
      .select("*, workouts(label, name)")
      .eq("user_id", userId)
      .order("started_at", { ascending: false }),
  ]);

  const workouts = workoutsRes.data ?? [];
  const workoutIds = workouts.map((w) => w.id);
  const { data: weData } = workoutIds.length
    ? await supabase
        .from("workout_exercises")
        .select("id, workout_id, order_idx, target_sets, target_reps, target_weight_kg, target_rest_seconds, notes, exercises(name, muscle_group)")
        .in("workout_id", workoutIds)
        .order("order_idx")
    : { data: [] as any[] };

  const sessions = sessionsRes.data ?? [];
  const sessionIds = sessions.map((s: any) => s.id);
  const { data: setsData } = sessionIds.length
    ? await supabase
        .from("session_sets")
        .select("session_id, set_number, reps, weight_kg, rpe, completed_at, exercises(name, muscle_group)")
        .in("session_id", sessionIds)
        .order("set_number")
    : { data: [] as any[] };

  const setsBySession = new Map<string, any[]>();
  for (const s of setsData ?? []) {
    const arr = setsBySession.get(s.session_id) ?? [];
    arr.push(s);
    setsBySession.set(s.session_id, arr);
  }
  const exByWorkout = new Map<string, any[]>();
  for (const e of weData ?? []) {
    const arr = exByWorkout.get(e.workout_id) ?? [];
    arr.push(e);
    exByWorkout.set(e.workout_id, arr);
  }

  return {
    version: 1,
    exported_at: new Date().toISOString(),
    user_id: userId,
    display_name: profileRes.data?.display_name ?? null,
    workouts: workouts.map((w) => ({
      id: w.id,
      label: w.label,
      name: w.name,
      notes: w.notes,
      order_idx: w.order_idx,
      exercises: (exByWorkout.get(w.id) ?? []).map((e: any) => ({
        exercise_name: e.exercises?.name ?? "",
        muscle_group: e.exercises?.muscle_group ?? "",
        order_idx: e.order_idx,
        target_sets: e.target_sets,
        target_reps: e.target_reps,
        target_weight_kg: e.target_weight_kg,
        target_rest_seconds: e.target_rest_seconds,
        notes: e.notes,
      })),
    })),
    sessions: sessions.map((s: any) => ({
      id: s.id,
      started_at: s.started_at,
      ended_at: s.ended_at,
      workout_label: s.workouts?.label ?? null,
      workout_name: s.workouts?.name ?? null,
      activity_type: s.activity_type,
      source: s.source,
      title: s.title,
      notes: s.notes,
      perceived_effort: s.perceived_effort,
      distance_m: s.distance_m,
      avg_hr: s.avg_hr,
      max_hr: s.max_hr,
      calories: s.calories,
      sets: (setsBySession.get(s.id) ?? []).map((x: any) => ({
        exercise_name: x.exercises?.name ?? "",
        muscle_group: x.exercises?.muscle_group ?? "",
        set_number: x.set_number,
        reps: x.reps,
        weight_kg: x.weight_kg,
        rpe: x.rpe,
        completed_at: x.completed_at,
      })),
    })),
  };
}

function csvEscape(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (/[",\n;]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function toCSV(data: ExportPayload): string {
  const headers = [
    "session_id",
    "started_at",
    "ended_at",
    "workout_label",
    "workout_name",
    "activity_type",
    "source",
    "title",
    "notes",
    "perceived_effort",
    "distance_m",
    "avg_hr",
    "max_hr",
    "calories",
    "exercise_name",
    "muscle_group",
    "set_number",
    "reps",
    "weight_kg",
    "rpe",
  ];
  const rows: string[] = [headers.join(",")];
  for (const s of data.sessions) {
    if (s.sets.length === 0) {
      rows.push(
        [
          s.id, s.started_at, s.ended_at ?? "", s.workout_label ?? "", s.workout_name ?? "",
          s.activity_type ?? "", s.source, s.title ?? "", s.notes ?? "",
          s.perceived_effort ?? "", s.distance_m ?? "", s.avg_hr ?? "", s.max_hr ?? "", s.calories ?? "",
          "", "", "", "", "", "",
        ].map(csvEscape).join(","),
      );
    } else {
      for (const x of s.sets) {
        rows.push(
          [
            s.id, s.started_at, s.ended_at ?? "", s.workout_label ?? "", s.workout_name ?? "",
            s.activity_type ?? "", s.source, s.title ?? "", s.notes ?? "",
            s.perceived_effort ?? "", s.distance_m ?? "", s.avg_hr ?? "", s.max_hr ?? "", s.calories ?? "",
            x.exercise_name, x.muscle_group, x.set_number, x.reps ?? "", x.weight_kg ?? "", x.rpe ?? "",
          ].map(csvEscape).join(","),
        );
      }
    }
  }
  return rows.join("\n");
}

function toTXT(data: ExportPayload): string {
  const lines: string[] = [];
  lines.push(`Backup de treinos — ${data.display_name ?? "Usuário"}`);
  lines.push(`Exportado em ${format(new Date(data.exported_at), "dd/MM/yyyy HH:mm")}`);
  lines.push("");
  lines.push(`Sessões (${data.sessions.length}):`);
  lines.push("=".repeat(60));
  for (const s of data.sessions) {
    lines.push("");
    lines.push(`[${format(new Date(s.started_at), "dd/MM/yyyy HH:mm")}] ${s.title || s.workout_name || s.activity_type || "Sessão"}`);
    if (s.workout_label) lines.push(`Plano: Treino ${s.workout_label} — ${s.workout_name ?? ""}`);
    if (s.perceived_effort != null) lines.push(`RPE: ${s.perceived_effort}`);
    if (s.distance_m != null) lines.push(`Distância: ${(s.distance_m / 1000).toFixed(2)} km`);
    if (s.avg_hr != null) lines.push(`FC média: ${s.avg_hr} bpm`);
    if (s.calories != null) lines.push(`Calorias: ${s.calories} kcal`);
    if (s.notes) lines.push(`Notas: ${s.notes}`);
    if (s.sets.length) {
      const byEx = new Map<string, typeof s.sets>();
      for (const x of s.sets) {
        const arr = byEx.get(x.exercise_name) ?? [];
        arr.push(x);
        byEx.set(x.exercise_name, arr as any);
      }
      for (const [name, arr] of byEx) {
        lines.push(`  • ${name}`);
        for (const x of arr) {
          const parts: string[] = [`    Série ${x.set_number}`];
          if (x.reps != null) parts.push(`${x.reps} reps`);
          if (x.weight_kg != null) parts.push(`${x.weight_kg} kg`);
          if (x.rpe != null) parts.push(`RPE ${x.rpe}`);
          lines.push(parts.join(" · "));
        }
      }
    }
    lines.push("-".repeat(60));
  }
  return lines.join("\n");
}

async function toPDF(data: ExportPayload): Promise<Blob> {
  const { default: jsPDF } = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  doc.setFontSize(16);
  doc.text(`Backup de treinos — ${data.display_name ?? "Usuário"}`, 40, 40);
  doc.setFontSize(10);
  doc.text(`Exportado em ${format(new Date(data.exported_at), "dd/MM/yyyy HH:mm")}`, 40, 58);
  doc.text(`${data.sessions.length} sessão(ões) · ${data.workouts.length} treino(s) do plano`, 40, 72);

  let y = 90;
  for (const s of data.sessions) {
    if (y > 720) { doc.addPage(); y = 40; }
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    const title = `${format(new Date(s.started_at), "dd/MM/yyyy HH:mm")} — ${s.title || s.workout_name || s.activity_type || "Sessão"}`;
    doc.text(title, 40, y);
    y += 14;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    const meta: string[] = [];
    if (s.workout_label) meta.push(`Treino ${s.workout_label}`);
    if (s.perceived_effort != null) meta.push(`RPE ${s.perceived_effort}`);
    if (s.distance_m != null) meta.push(`${(s.distance_m / 1000).toFixed(2)} km`);
    if (s.avg_hr != null) meta.push(`FC ${s.avg_hr}bpm`);
    if (s.calories != null) meta.push(`${s.calories} kcal`);
    if (meta.length) { doc.text(meta.join(" · "), 40, y); y += 12; }
    if (s.notes) { doc.text(`Notas: ${s.notes.slice(0, 120)}`, 40, y); y += 12; }

    if (s.sets.length) {
      autoTable(doc, {
        startY: y,
        head: [["Exercício", "Grupo", "Série", "Reps", "Peso (kg)", "RPE"]],
        body: s.sets.map((x) => [
          x.exercise_name, x.muscle_group, x.set_number,
          x.reps ?? "-", x.weight_kg ?? "-", x.rpe ?? "-",
        ]),
        styles: { fontSize: 8, cellPadding: 3 },
        headStyles: { fillColor: [30, 30, 30] },
        margin: { left: 40, right: 40 },
      });
      y = (doc as any).lastAutoTable.finalY + 16;
    } else {
      y += 8;
    }
  }
  return doc.output("blob");
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// ---------- IMPORT ----------

function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let cur: string[] = [];
  let field = "";
  let i = 0;
  let inQ = false;
  const sep = text.includes(";") && !text.includes(",") ? ";" : ",";
  while (i < text.length) {
    const c = text[i];
    if (inQ) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 2; continue; }
        inQ = false; i++; continue;
      }
      field += c; i++;
    } else {
      if (c === '"') { inQ = true; i++; }
      else if (c === sep) { cur.push(field); field = ""; i++; }
      else if (c === "\n") { cur.push(field); rows.push(cur); cur = []; field = ""; i++; }
      else if (c === "\r") { i++; }
      else { field += c; i++; }
    }
  }
  if (field.length || cur.length) { cur.push(field); rows.push(cur); }
  return rows.filter((r) => r.length > 1 || (r[0] && r[0].length > 0));
}

async function ensureExercise(userId: string, name: string, muscle: string, cache: Map<string, string>): Promise<string | null> {
  const key = `${name.toLowerCase()}|${(muscle || "").toLowerCase()}`;
  if (cache.has(key)) return cache.get(key)!;
  if (!name) return null;
  const { data: existing } = await supabase
    .from("exercises")
    .select("id")
    .ilike("name", name)
    .limit(1)
    .maybeSingle();
  if (existing) { cache.set(key, existing.id); return existing.id; }
  const { data: created, error } = await supabase
    .from("exercises")
    .insert({ name, muscle_group: muscle || "outros", is_default: false, created_by: userId })
    .select("id")
    .single();
  if (error || !created) return null;
  cache.set(key, created.id);
  return created.id;
}

type ImportResult = { sessions: number; sets: number; skipped: number; errors: number };

async function importPayload(userId: string, payload: ExportPayload): Promise<ImportResult> {
  const result: ImportResult = { sessions: 0, sets: 0, skipped: 0, errors: 0 };
  const cache = new Map<string, string>();

  // Fetch existing sessions to skip duplicates by started_at
  const { data: existingSessions } = await supabase
    .from("sessions")
    .select("started_at")
    .eq("user_id", userId);
  const existingSet = new Set((existingSessions ?? []).map((s: any) => new Date(s.started_at).toISOString()));

  for (const s of payload.sessions ?? []) {
    try {
      const startedIso = new Date(s.started_at).toISOString();
      if (existingSet.has(startedIso)) { result.skipped++; continue; }

      const { data: inserted, error: e1 } = await supabase.from("sessions").insert({
        user_id: userId,
        started_at: s.started_at,
        ended_at: s.ended_at,
        activity_type: s.activity_type,
        source: s.source ?? "import",
        title: s.title,
        notes: s.notes,
        perceived_effort: s.perceived_effort,
        distance_m: s.distance_m,
        avg_hr: s.avg_hr,
        max_hr: s.max_hr,
        calories: s.calories,
      }).select("id").single();
      if (e1 || !inserted) { result.errors++; continue; }
      result.sessions++;

      for (const x of s.sets ?? []) {
        const exId = await ensureExercise(userId, x.exercise_name, x.muscle_group, cache);
        if (!exId) { result.errors++; continue; }
        const { error: e2 } = await supabase.from("session_sets").insert({
          session_id: inserted.id,
          exercise_id: exId,
          set_number: x.set_number,
          reps: x.reps,
          weight_kg: x.weight_kg,
          rpe: x.rpe,
        });
        if (e2) result.errors++;
        else result.sets++;
      }
    } catch {
      result.errors++;
    }
  }
  return result;
}

function csvToPayload(text: string): ExportPayload {
  const rows = parseCSV(text);
  if (rows.length < 2) throw new Error("CSV vazio");
  const header = rows[0].map((h) => h.trim().toLowerCase());
  const idx = (n: string) => header.indexOf(n);
  const iSid = idx("session_id");
  const iStart = idx("started_at");
  const iEnd = idx("ended_at");
  const iWl = idx("workout_label");
  const iWn = idx("workout_name");
  const iAct = idx("activity_type");
  const iSrc = idx("source");
  const iTitle = idx("title");
  const iNotes = idx("notes");
  const iRpe = idx("perceived_effort");
  const iDist = idx("distance_m");
  const iAvg = idx("avg_hr");
  const iMax = idx("max_hr");
  const iCal = idx("calories");
  const iEx = idx("exercise_name");
  const iMg = idx("muscle_group");
  const iSn = idx("set_number");
  const iReps = idx("reps");
  const iW = idx("weight_kg");
  const iSetRpe = idx("rpe");

  if (iStart < 0) throw new Error("CSV precisa da coluna started_at");

  const sessionsMap = new Map<string, any>();
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    const key = (iSid >= 0 && row[iSid]) || row[iStart];
    if (!key) continue;
    let sess = sessionsMap.get(key);
    if (!sess) {
      sess = {
        id: key,
        started_at: row[iStart],
        ended_at: iEnd >= 0 ? row[iEnd] || null : null,
        workout_label: iWl >= 0 ? row[iWl] || null : null,
        workout_name: iWn >= 0 ? row[iWn] || null : null,
        activity_type: iAct >= 0 ? row[iAct] || null : null,
        source: (iSrc >= 0 ? row[iSrc] : "") || "import",
        title: iTitle >= 0 ? row[iTitle] || null : null,
        notes: iNotes >= 0 ? row[iNotes] || null : null,
        perceived_effort: iRpe >= 0 && row[iRpe] ? Number(row[iRpe]) : null,
        distance_m: iDist >= 0 && row[iDist] ? Number(row[iDist]) : null,
        avg_hr: iAvg >= 0 && row[iAvg] ? Number(row[iAvg]) : null,
        max_hr: iMax >= 0 && row[iMax] ? Number(row[iMax]) : null,
        calories: iCal >= 0 && row[iCal] ? Number(row[iCal]) : null,
        sets: [],
      };
      sessionsMap.set(key, sess);
    }
    if (iEx >= 0 && row[iEx]) {
      sess.sets.push({
        exercise_name: row[iEx],
        muscle_group: iMg >= 0 ? row[iMg] || "outros" : "outros",
        set_number: iSn >= 0 && row[iSn] ? Number(row[iSn]) : sess.sets.length + 1,
        reps: iReps >= 0 && row[iReps] ? Number(row[iReps]) : null,
        weight_kg: iW >= 0 && row[iW] ? Number(row[iW]) : null,
        rpe: iSetRpe >= 0 && row[iSetRpe] ? Number(row[iSetRpe]) : null,
        completed_at: row[iStart],
      });
    }
  }

  return {
    version: 1,
    exported_at: new Date().toISOString(),
    user_id: "",
    display_name: null,
    workouts: [],
    sessions: Array.from(sessionsMap.values()),
  };
}

export function DataManagement({ userId, displayName }: { userId: string; displayName: string | null }) {
  const qc = useQueryClient();
  const [fmt, setFmt] = useState<Fmt>("json");
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [caching, setCaching] = useState(false);
  const [cachedAt, setCachedAt] = useState<string | null>(() =>
    typeof localStorage !== "undefined" ? localStorage.getItem("offline-cache-at") : null,
  );
  const fileRef = useRef<HTMLInputElement>(null);

  async function doCacheOffline() {
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      toast.error("Você precisa estar online para baixar seus dados.");
      return;
    }
    setCaching(true);
    try {
      await prefetchOfflineEssentials(qc, userId);
      const now = new Date().toISOString();
      localStorage.setItem("offline-cache-at", now);
      setCachedAt(now);
      toast.success("Treinos e exercícios prontos para uso offline!");
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao preparar dados offline");
    } finally {
      setCaching(false);
    }
  }

  const baseName = (displayName || "usuario").replace(/[^a-zA-Z0-9-_]/g, "_").slice(0, 30);

  async function doExport() {
    setExporting(true);
    try {
      const data = await fetchAll(userId);
      const stamp = format(new Date(), "yyyy-MM-dd");
      const filename = `treino_exportacao_${baseName}_${stamp}.${fmt}`;
      if (fmt === "json") {
        downloadBlob(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }), filename);
      } else if (fmt === "csv") {
        downloadBlob(new Blob(["\ufeff" + toCSV(data)], { type: "text/csv;charset=utf-8" }), filename);
      } else if (fmt === "txt") {
        downloadBlob(new Blob([toTXT(data)], { type: "text/plain;charset=utf-8" }), filename);
      } else if (fmt === "pdf") {
        const blob = await toPDF(data);
        downloadBlob(blob, filename);
      }
      toast.success("Seu treino foi exportado com sucesso!");
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao exportar");
    } finally {
      setExporting(false);
    }
  }

  async function onFile(file: File) {
    if (file.size > 20 * 1024 * 1024) { toast.error("Arquivo muito grande (máx 20MB)"); return; }
    setImporting(true);
    try {
      const text = await file.text();
      let payload: ExportPayload;
      if (file.name.toLowerCase().endsWith(".json")) {
        const parsed = JSON.parse(text);
        if (!parsed || !Array.isArray(parsed.sessions)) throw new Error("JSON inválido: falta o campo 'sessions'");
        payload = parsed as ExportPayload;
      } else if (file.name.toLowerCase().endsWith(".csv")) {
        payload = csvToPayload(text);
      } else {
        throw new Error("Formato não suportado. Use .json ou .csv");
      }
      if (!payload.sessions.length) throw new Error("Nenhuma sessão encontrada no arquivo");
      const result = await importPayload(userId, payload);
      qc.invalidateQueries();
      toast.success(
        `Importação concluída: ${result.sessions} sessão(ões), ${result.sets} série(s)` +
          (result.skipped ? ` · ${result.skipped} ignorada(s) (duplicadas)` : "") +
          (result.errors ? ` · ${result.errors} erro(s)` : ""),
      );
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao importar");
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className="card-soft mt-6 space-y-5 p-5">
      <div className="flex items-center gap-2">
        <Database className="size-5 text-brand" />
        <h2 className="text-lg font-semibold">Gerenciamento de dados</h2>
      </div>
      <p className="text-xs text-muted-foreground">
        Faça backup dos seus treinos ou importe dados de outro dispositivo. Duplicatas (mesma data/hora de início) são ignoradas automaticamente.
      </p>

      <div className="space-y-2 rounded-lg border border-border bg-muted/30 p-3">
        <p className="text-sm font-semibold">Baixar para uso offline</p>
        <p className="text-[11px] text-muted-foreground">
          Salva seus treinos, exercícios, perfil e histórico neste dispositivo para abrir sem internet.
        </p>
        <Button
          onClick={doCacheOffline}
          disabled={caching}
          variant="secondary"
          className="w-full"
        >
          {caching ? <Loader2 className="size-4 animate-spin" /> : <CloudDownload className="size-4" />}
          {caching ? "Baixando dados..." : "Baixar meus dados para offline"}
        </Button>
        {cachedAt && (
          <p className="text-[11px] text-muted-foreground">
            Última sincronização: {format(new Date(cachedAt), "dd/MM/yyyy 'às' HH:mm")}
          </p>
        )}
      </div>


      <div className="space-y-2">
        <p className="text-sm font-semibold">Exportar dados de treino</p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Select value={fmt} onValueChange={(v) => setFmt(v as Fmt)}>
            <SelectTrigger className="sm:w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="json">JSON (backup completo)</SelectItem>
              <SelectItem value="csv">CSV (planilha)</SelectItem>
              <SelectItem value="pdf">PDF (relatório)</SelectItem>
              <SelectItem value="txt">TXT (texto simples)</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={doExport} disabled={exporting} className="flex-1">
            {exporting ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
            {exporting ? "Preparando arquivo..." : "Exportar treino"}
          </Button>
        </div>
        <p className="text-[11px] text-muted-foreground">
          JSON e CSV podem ser reimportados. PDF e TXT são apenas para leitura.
        </p>
      </div>

      <div className="space-y-2 border-t border-border pt-4">
        <p className="text-sm font-semibold">Importar dados de treino</p>
        <input
          ref={fileRef}
          type="file"
          accept=".json,.csv"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) void onFile(f); }}
        />
        <Button
          variant="outline"
          onClick={() => fileRef.current?.click()}
          disabled={importing}
          className="w-full"
        >
          {importing ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
          {importing ? "Processando arquivo..." : "Selecionar arquivo (.json ou .csv)"}
        </Button>
        <p className="text-[11px] text-muted-foreground">
          Dados existentes serão mantidos. Novos treinos serão adicionados; sessões com a mesma data/hora de início são ignoradas. Exercícios desconhecidos são criados automaticamente.
        </p>
      </div>
    </div>
  );
}
