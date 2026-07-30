// Versões do plano de treino: antes de qualquer atualização automática (ou
// manual em lote) guardamos um snapshot dos valores anteriores de
// carga/descanso dos exercícios afetados. Isso permite desfazer uma
// atualização que o usuário não gostou, mesmo dias depois.
//
// Armazenado localmente (IndexedDB via idb-keyval), por usuário.

import { get, set } from "idb-keyval";

export type PlanVersionEntry = {
  itemId: string;
  exerciseName: string;
  workoutName: string;
  before: { target_weight_kg: number | null; target_rest_seconds: number };
  after: { target_weight_kg?: number | null; target_rest_seconds?: number };
};

export type PlanVersion = {
  id: string;
  createdAt: string;
  label: string;
  source: "auto-progression" | "manual";
  entries: PlanVersionEntry[];
  restoredAt?: string | null;
};

const MAX_VERSIONS = 20;

const storeKey = (userId: string) => `plan-versions:${userId}`;

function newId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `pv-${Math.random().toString(36).slice(2)}-${Date.now()}`;
}

export async function listPlanVersions(userId: string): Promise<PlanVersion[]> {
  if (typeof window === "undefined") return [];
  const list = (await get<PlanVersion[]>(storeKey(userId))) ?? [];
  return list.slice().sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

async function writeAll(userId: string, list: PlanVersion[]) {
  await set(storeKey(userId), list.slice(0, MAX_VERSIONS));
}

/** Guarda um snapshot antes de aplicar mudanças. Devolve a versão criada. */
export async function savePlanVersion(
  userId: string,
  args: { label: string; source: PlanVersion["source"]; entries: PlanVersionEntry[] },
): Promise<PlanVersion | null> {
  if (typeof window === "undefined" || args.entries.length === 0) return null;
  const version: PlanVersion = {
    id: newId(),
    createdAt: new Date().toISOString(),
    label: args.label,
    source: args.source,
    entries: args.entries,
    restoredAt: null,
  };
  const list = await listPlanVersions(userId);
  await writeAll(userId, [version, ...list]);
  return version;
}

/** Reaplica os valores anteriores registrados na versão. Retorna quantos itens voltaram. */
export async function restorePlanVersion(userId: string, versionId: string): Promise<number> {
  const list = await listPlanVersions(userId);
  const version = list.find((v) => v.id === versionId);
  if (!version) throw new Error("Versão não encontrada");

  const { writeUpdate } = await import("@/lib/offline-writes");
  let restored = 0;
  for (const e of version.entries) {
    const patch: Record<string, unknown> = {};
    if (e.after.target_weight_kg !== undefined) patch.target_weight_kg = e.before.target_weight_kg;
    if (e.after.target_rest_seconds !== undefined) patch.target_rest_seconds = e.before.target_rest_seconds;
    if (Object.keys(patch).length === 0) continue;
    try {
      await writeUpdate("workout_exercises", { id: e.itemId }, patch);
      restored++;
    } catch {
      // segue para os próximos; falhas permanentes ficam na fila offline
    }
  }

  await writeAll(
    userId,
    list.map((v) => (v.id === versionId ? { ...v, restoredAt: new Date().toISOString() } : v)),
  );
  return restored;
}

export async function deletePlanVersion(userId: string, versionId: string): Promise<void> {
  const list = await listPlanVersions(userId);
  await writeAll(userId, list.filter((v) => v.id !== versionId));
}

export async function clearPlanVersions(userId: string): Promise<void> {
  await writeAll(userId, []);
}
