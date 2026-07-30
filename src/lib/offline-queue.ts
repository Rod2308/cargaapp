// Offline write queue: persists Supabase mutations in IndexedDB and replays
// them when the network returns. Reads still hit Supabase directly (React
// Query caches keep last-known data in memory during the session).
//
// Operações que falham por erro permanente (RLS, constraint, validação) NÃO
// são mais descartadas em silêncio: elas vão para uma lista `failed` separada,
// persistida, que a UI mostra ("N alterações não sincronizaram") com opção de
// tentar de novo ou descartar.

import { get, set } from "idb-keyval";
import { supabase } from "@/integrations/supabase/client";
import { clearPendingSyncedSessionSnapshots } from "@/lib/session-persist";

const KEY = "carga.sync.queue.v1";
const FAILED_KEY = "carga.sync.failed.v1";

export type QueueOp = {
  id: string;
  kind: "insert" | "upsert" | "update" | "delete";
  table: string;
  row?: any;
  match?: Record<string, any>;
  patch?: any;
  onConflict?: string;
  ignoreDuplicates?: boolean;
  createdAt: number;
};

export type FailedOp = QueueOp & {
  failedAt: number;
  error: string;
  attempts: number;
};

let queue: QueueOp[] = [];
let failed: FailedOp[] = [];
let loaded = false;
let flushing = false;
let flushPromise: Promise<void> | null = null;
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((l) => l());
}

async function load() {
  if (loaded) return;
  try {
    queue = (await get<QueueOp[]>(KEY)) ?? [];
  } catch {
    queue = [];
  }
  try {
    failed = (await get<FailedOp[]>(FAILED_KEY)) ?? [];
  } catch {
    failed = [];
  }
  loaded = true;
}

async function persist() {
  try {
    await set(KEY, queue);
  } catch {
    /* storage full or unavailable */
  }
  notify();
  maybeClearSnapshots();
}

async function persistFailed() {
  try {
    await set(FAILED_KEY, failed);
  } catch {
    /* storage full or unavailable */
  }
  notify();
  maybeClearSnapshots();
}

function maybeClearSnapshots() {
  if (queue.length === 0 && failed.length === 0) {
    void clearPendingSyncedSessionSnapshots();
  }
}

function isNetworkError(err: unknown): boolean {
  if (typeof navigator !== "undefined" && !navigator.onLine) return true;
  const msg = String((err as any)?.message ?? "");
  return (
    msg.includes("Failed to fetch") ||
    msg.includes("NetworkError") ||
    msg.includes("network") ||
    msg.includes("Load failed")
  );
}

function errorMessage(err: unknown): string {
  const e = err as { message?: string; details?: string; code?: string } | null;
  return (
    e?.message ||
    e?.details ||
    (e?.code ? `Erro ${e.code}` : "") ||
    String(err ?? "Erro desconhecido")
  );
}

async function execute(op: QueueOp) {
  const table = supabase.from(op.table as any);
  if (op.kind === "insert") {
    const { error } = op.row?.id
      ? await table.upsert(op.row, { onConflict: "id", ignoreDuplicates: true })
      : await table.insert(op.row);
    if (error) throw error;
    return;
  }
  if (op.kind === "upsert") {
    const { error } = await table.upsert(op.row, {
      onConflict: op.onConflict,
      ignoreDuplicates: op.ignoreDuplicates ?? false,
    });
    if (error) throw error;
    return;
  }
  if (op.kind === "update") {
    let q: any = table.update(op.patch);
    for (const [k, v] of Object.entries(op.match ?? {})) q = q.eq(k, v);
    const { error } = await q;
    if (error) throw error;
    return;
  }
  if (op.kind === "delete") {
    let q: any = table.delete();
    for (const [k, v] of Object.entries(op.match ?? {})) q = q.eq(k, v);
    const { error } = await q;
    if (error) throw error;
  }
}

// Tabelas com coluna UNIQUE `client_mutation_id` — inserts recebem o id
// automaticamente para permitir retry seguro (idempotência).
const IDEMPOTENT_TABLES = new Set([
  "sessions",
  "session_sets",
  "workouts",
  "workout_exercises",
  "messages",
  "group_messages",
  "daily_checkins",
  "sleep_logs",
]);

export async function enqueueOp(op: Omit<QueueOp, "id" | "createdAt">) {
  await load();
  const id = crypto.randomUUID();
  let row = op.row;
  if (
    op.kind === "insert" &&
    row &&
    typeof row === "object" &&
    !Array.isArray(row) &&
    IDEMPOTENT_TABLES.has(op.table) &&
    row.client_mutation_id == null
  ) {
    row = { ...row, client_mutation_id: id };
  }
  queue.push({ ...op, row, id, createdAt: Date.now() });
  await persist();
  void flush();
}

export async function flush() {
  await load();
  if (flushing) return flushPromise ?? undefined;
  if (typeof navigator !== "undefined" && !navigator.onLine) return;
  if (queue.length === 0) return;
  flushing = true;
  flushPromise = (async () => {
    while (queue.length > 0) {
      const op = queue[0];
      try {
        await execute(op);
      } catch (err) {
        if (isNetworkError(err)) break; // keep queued, retry later
        // Falha permanente (RLS, constraint, etc.): move para a lista de
        // falhas visível ao usuário em vez de descartar em silêncio.
        console.error("[sync] operação falhou permanentemente", op, err);
        failed.push({
          ...op,
          failedAt: Date.now(),
          error: errorMessage(err),
          attempts: ((op as Partial<FailedOp>).attempts ?? 0) + 1,
        });
        await persistFailed();
      }
      queue.shift();
      await persist();
    }
  })();
  try {
    await flushPromise;
  } finally {
    flushing = false;
    flushPromise = null;
  }
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export async function getPendingCount(): Promise<number> {
  await load();
  return queue.length;
}

export function getPendingCountSync(): number {
  return queue.length;
}

/** Operações que falharam por erro permanente e aguardam decisão do usuário. */
export async function getFailedOps(): Promise<FailedOp[]> {
  await load();
  return [...failed];
}

export function getFailedCountSync(): number {
  return failed.length;
}

/** Recoloca uma operação que falhou de volta na fila e tenta sincronizar. */
export async function retryFailedOp(id: string) {
  await load();
  const idx = failed.findIndex((f) => f.id === id);
  if (idx === -1) return;
  const [op] = failed.splice(idx, 1);
  await persistFailed();
  const { failedAt: _f, error: _e, ...rest } = op;
  queue.push(rest as QueueOp);
  await persist();
  void flush();
}

/** Recoloca todas as operações falhas na fila. */
export async function retryAllFailedOps() {
  await load();
  if (failed.length === 0) return;
  const ops = failed.map(({ failedAt: _f, error: _e, ...rest }) => rest as QueueOp);
  failed = [];
  await persistFailed();
  queue.push(...ops);
  await persist();
  void flush();
}

/** Descarta definitivamente uma operação falha (decisão explícita do usuário). */
export async function discardFailedOp(id: string) {
  await load();
  failed = failed.filter((f) => f.id !== id);
  await persistFailed();
}

export async function discardAllFailedOps() {
  await load();
  failed = [];
  await persistFailed();
}

let initialized = false;
export function initSyncQueue() {
  if (initialized || typeof window === "undefined") return;
  initialized = true;
  void load().then(() => {
    notify();
    maybeClearSnapshots();
    void flush();
  });
  window.addEventListener("online", () => void flush());
  window.addEventListener("focus", () => void flush());
  window.setInterval(() => void flush(), 30_000);
}
