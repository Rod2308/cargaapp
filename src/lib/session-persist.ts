// Persistência local do treino em andamento.
// Guarda um snapshot da sessão (dados, plano e séries) e um rascunho do
// modal de finalização (esforço + desconforto) em IndexedDB, para que o
// progresso sobreviva a quedas de conexão, recargas de página ou o app ser
// fechado no meio do treino.

import { get, set } from "idb-keyval";

const snapKey = (id: string) => `carga.session.snap.${id}`;
const draftKey = (id: string) => `carga.session.draft.${id}`;

export type SessionSnapshot = {
  session: any | null;
  items: any[];
  sets: any[];
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
    await set(snapKey(id), undefined);
    await set(draftKey(id), undefined);
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
