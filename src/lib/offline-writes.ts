// Helper para escrita "atravessa fila": tenta a chamada Supabase primeiro;
// se falhar por rede (ou o navegador estiver offline), gera um id local,
// enfileira para sync e devolve o payload otimista imediatamente.
//
// Uso típico dentro de uma useMutation:
//   const row = await writeInsert("workouts", { user_id, name, ... });
//   qc.setQueryData(["workouts", user_id], (old = []) => [...old, row]);

import { supabase } from "@/integrations/supabase/client";
import { enqueueOp } from "@/lib/offline-queue";

function isOffline() {
  return typeof navigator !== "undefined" && !navigator.onLine;
}

function isNetworkError(err: unknown): boolean {
  if (isOffline()) return true;
  const msg = String((err as { message?: string } | null)?.message ?? "");
  return (
    msg.includes("Failed to fetch") ||
    msg.includes("NetworkError") ||
    msg.includes("network") ||
    msg.includes("Load failed")
  );
}

function newId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `local-${Math.random().toString(36).slice(2)}-${Date.now()}`;
}

/** Insere e devolve o registro (real quando online; sintético+enfileirado quando offline). */
export async function writeInsert<T extends Record<string, unknown>>(
  table: string,
  row: T,
): Promise<T & { id: string; _pending?: boolean }> {
  const payload = { id: newId(), ...row } as T & { id: string };
  if (isOffline()) {
    await enqueueOp({ kind: "insert", table, row: payload });
    return { ...payload, _pending: true };
  }
  try {
    const { data, error } = await supabase
      .from(table as never)
      .insert(payload as never)
      .select()
      .single();
    if (error) throw error;
    return data as T & { id: string };
  } catch (err) {
    if (isNetworkError(err)) {
      await enqueueOp({ kind: "insert", table, row: payload });
      return { ...payload, _pending: true };
    }
    throw err;
  }
}

/** Upsert (para tabelas com chave natural, ex.: daily_checkins, sleep_logs). */
export async function writeUpsert<T extends Record<string, unknown>>(
  table: string,
  row: T,
  opts: { onConflict: string; ignoreDuplicates?: boolean } = { onConflict: "id" },
): Promise<void> {
  if (isOffline()) {
    await enqueueOp({ kind: "upsert", table, row, onConflict: opts.onConflict, ignoreDuplicates: opts.ignoreDuplicates });
    return;
  }
  try {
    const { error } = await supabase.from(table as never).upsert(row as never, opts);
    if (error) throw error;
  } catch (err) {
    if (isNetworkError(err)) {
      await enqueueOp({ kind: "upsert", table, row, onConflict: opts.onConflict, ignoreDuplicates: opts.ignoreDuplicates });
      return;
    }
    throw err;
  }
}

/** Update por match (ex.: `{ id }`). */
export async function writeUpdate(
  table: string,
  match: Record<string, unknown>,
  patch: Record<string, unknown>,
): Promise<void> {
  if (isOffline()) {
    await enqueueOp({ kind: "update", table, match, patch });
    return;
  }
  try {
    let q = supabase.from(table as never).update(patch as never) as unknown as {
      eq: (k: string, v: unknown) => typeof q;
      then: Promise<{ error: unknown }>["then"];
    };
    for (const [k, v] of Object.entries(match)) q = q.eq(k, v);
    const { error } = await (q as unknown as Promise<{ error: unknown }>);
    if (error) throw error;
  } catch (err) {
    if (isNetworkError(err)) {
      await enqueueOp({ kind: "update", table, match, patch });
      return;
    }
    throw err;
  }
}

/** Delete por match. */
export async function writeDelete(
  table: string,
  match: Record<string, unknown>,
): Promise<void> {
  if (isOffline()) {
    await enqueueOp({ kind: "delete", table, match });
    return;
  }
  try {
    let q = supabase.from(table as never).delete() as unknown as {
      eq: (k: string, v: unknown) => typeof q;
      then: Promise<{ error: unknown }>["then"];
    };
    for (const [k, v] of Object.entries(match)) q = q.eq(k, v);
    const { error } = await (q as unknown as Promise<{ error: unknown }>);
    if (error) throw error;
  } catch (err) {
    if (isNetworkError(err)) {
      await enqueueOp({ kind: "delete", table, match });
      return;
    }
    throw err;
  }
}
