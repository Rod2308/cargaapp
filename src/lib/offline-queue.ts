// Offline write queue: persists Supabase mutations in IndexedDB and replays
// them when the network returns. Reads still hit Supabase directly (React
// Query caches keep last-known data in memory during the session).

import { get, set } from "idb-keyval";
import { supabase } from "@/integrations/supabase/client";
import { clearPendingSyncedSessionSnapshots } from "@/lib/session-persist";

const KEY = "carga.sync.queue.v1";

export type QueueOp = {
  id: string;
  kind: "insert" | "update" | "delete";
  table: string;
  row?: any;
  match?: Record<string, any>;
  patch?: any;
  createdAt: number;
};

let queue: QueueOp[] = [];
let loaded = false;
let flushing = false;
let flushPromise: Promise<void> | null = null;
const listeners = new Set<() => void>();

async function load() {
  if (loaded) return;
  try {
    queue = (await get<QueueOp[]>(KEY)) ?? [];
  } catch {
    queue = [];
  }
  loaded = true;
}

async function persist() {
  try {
    await set(KEY, queue);
  } catch {
    /* storage full or unavailable */
  }
  listeners.forEach((l) => l());
  if (queue.length === 0) void clearPendingSyncedSessionSnapshots();
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

async function execute(op: QueueOp) {
  const table = supabase.from(op.table as any);
  if (op.kind === "insert") {
    const { error } = op.row?.id
      ? await table.upsert(op.row, { onConflict: "id", ignoreDuplicates: true })
      : await table.insert(op.row);
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

export async function enqueueOp(op: Omit<QueueOp, "id" | "createdAt">) {
  await load();
  queue.push({ ...op, id: crypto.randomUUID(), createdAt: Date.now() });
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
        // Permanent failure (RLS, constraint, etc.) — drop and move on.
        console.error("[sync] dropping op", op, err);
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

let initialized = false;
export function initSyncQueue() {
  if (initialized || typeof window === "undefined") return;
  initialized = true;
  void load().then(() => {
    listeners.forEach((l) => l());
    if (queue.length === 0) void clearPendingSyncedSessionSnapshots();
    void flush();
  });
  window.addEventListener("online", () => void flush());
  window.addEventListener("focus", () => void flush());
  window.setInterval(() => void flush(), 30_000);
}
