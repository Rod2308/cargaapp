// Persistência local do treino em andamento.
// Guarda um snapshot da sessão (dados, plano e séries) e um rascunho do
// modal de finalização (esforço + desconforto) em IndexedDB, para que o
// progresso sobreviva a quedas de conexão, recargas de página ou o app ser
// fechado no meio do treino.

import { del, get, set } from "idb-keyval";

const snapKey = (id: string) => `carga.session.snap.${id}`;
const draftKey = (id: string) => `carga.session.draft.${id}`;
const PENDING_CLEAR_KEY = "carga.session.pending-clear.v1";

export type RestSnapshot = {
  remaining: number;
  total: number;
  paused: boolean;
  done: boolean;
  exerciseName?: string;
  updatedAt: number;
} | null;

export type SessionSnapshot = {
  session: any | null;
  items: any[];
  sets: any[];
  rest?: RestSnapshot;
  savedAt: number;
};

export type FinishDraft = {
  effort: number | null;
  discomfort: string;
};

export async function loadSessionSnapshot(id: string): Promise<SessionSnapshot | null> {
  try {
    return (await get<SessionSnapshot>(snapKey(id))) ?? null;
  } catch {
    return null;
  }
}

export async function saveSessionSnapshot(id: string, snap: Omit<SessionSnapshot, "savedAt">) {
  try {
    await set(snapKey(id), { ...snap, savedAt: Date.now() });
  } catch {
    /* storage indisponível */
  }
}

export async function clearSessionSnapshot(id: string) {
  try {
    await del(snapKey(id));
    await del(draftKey(id));
    const pending = new Set((await get<string[]>(PENDING_CLEAR_KEY)) ?? []);
    pending.delete(id);
    await set(PENDING_CLEAR_KEY, Array.from(pending));
  } catch {
    /* ignore */
  }
}

export async function markSessionSnapshotPendingClear(id: string) {
  try {
    const pending = new Set((await get<string[]>(PENDING_CLEAR_KEY)) ?? []);
    pending.add(id);
    await set(PENDING_CLEAR_KEY, Array.from(pending));
  } catch {
    /* ignore */
  }
}

export async function clearPendingSyncedSessionSnapshots() {
  try {
    const ids = (await get<string[]>(PENDING_CLEAR_KEY)) ?? [];
    if (ids.length === 0) return;
    await Promise.all(ids.map((id) => Promise.all([del(snapKey(id)), del(draftKey(id))])));
    await set(PENDING_CLEAR_KEY, []);
  } catch {
    /* ignore */
  }
}

export async function loadFinishDraft(id: string): Promise<FinishDraft | null> {
  try {
    return (await get<FinishDraft>(draftKey(id))) ?? null;
  } catch {
    return null;
  }
}

export async function saveFinishDraft(id: string, draft: FinishDraft) {
  try {
    await set(draftKey(id), draft);
  } catch {
    /* ignore */
  }
}
