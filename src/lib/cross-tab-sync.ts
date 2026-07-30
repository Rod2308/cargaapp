import type { QueryClient } from "@tanstack/react-query";

/**
 * Sincronização de cache entre abas.
 *
 * Quando uma aba grava um check-in, sono ou sessão, ela avisa as outras abas
 * para invalidarem as mesmas queries — assim "Recuperação" e "Sugestão de hoje"
 * nunca ficam divergentes por causa de um fetch atrasado.
 *
 * Usa BroadcastChannel quando disponível e cai para o evento `storage` do
 * localStorage em navegadores antigos (inclui Safari iOS mais velho).
 */

const CHANNEL_NAME = "carga-cross-tab-sync";
const STORAGE_KEY = "carga:cross-tab-sync";

export type SyncKey = readonly unknown[];

type SyncMessage = {
  type: "invalidate";
  keys: unknown[][];
  /** id da aba que originou — evita processar o próprio eco */
  origin: string;
  at: number;
};

/**
 * ID da aba gerado sob demanda.
 *
 * IMPORTANTE: não pode ser gerado em escopo de módulo. No runtime de produção
 * (Cloudflare Worker) qualquer geração de valor aleatório em escopo global
 * lança "Disallowed operation called within global scope" e derruba o SSR
 * inteiro com HTTP 500 em todas as rotas.
 */
let tabId: string | null = null;

function getTabId(): string {
  if (tabId) return tabId;
  tabId =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2);
  return tabId;
}

let channel: BroadcastChannel | null = null;


function getChannel(): BroadcastChannel | null {
  if (typeof window === "undefined") return null;
  if (typeof BroadcastChannel === "undefined") return null;
  if (!channel) {
    try {
      channel = new BroadcastChannel(CHANNEL_NAME);
    } catch {
      channel = null;
    }
  }
  return channel;
}

function post(message: SyncMessage) {
  const ch = getChannel();
  if (ch) {
    try {
      ch.postMessage(message);
      return;
    } catch {
      /* cai para o fallback abaixo */
    }
  }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(message));
  } catch {
    /* storage indisponível (modo privado) — sem sync, sem quebrar */
  }
}

/** Avisa as outras abas para invalidarem estas queries. */
export function broadcastInvalidate(keys: SyncKey[]) {
  if (typeof window === "undefined" || keys.length === 0) return;
  post({
    type: "invalidate",
    keys: keys.map((k) => [...k]),
    origin: getTabId(),
    at: Date.now(),
  });
}

/**
 * Invalida localmente E avisa as outras abas. Substitui chamadas soltas de
 * `qc.invalidateQueries` em mutações que afetam Recuperação/Sugestão.
 */
export function syncInvalidate(qc: QueryClient, keys: SyncKey[]) {
  for (const key of keys) {
    void qc.invalidateQueries({ queryKey: [...key] });
  }
  broadcastInvalidate(keys);
}

/** Chaves que alimentam os cards de Recuperação e Sugestão de hoje. */
export const RECOVERY_SYNC_KEYS: SyncKey[] = [
  ["recovery"],
  ["daily-checkin"],
  ["sleep-logs"],
  ["recent-sessions"],
  ["month-sessions"],
  ["history-sessions"],
  ["daily-suggestion"],
];

/**
 * Liga o listener global. Chamar UMA vez, na raiz do app.
 * Retorna a função de cleanup.
 */
export function initCrossTabSync(qc: QueryClient): () => void {
  if (typeof window === "undefined") return () => {};

  const apply = (raw: unknown) => {
    const msg = raw as SyncMessage | null;
    if (!msg || msg.type !== "invalidate" || msg.origin === getTabId()) return;
    if (!Array.isArray(msg.keys)) return;
    for (const key of msg.keys) {
      if (!Array.isArray(key) || key.length === 0) continue;
      void qc.invalidateQueries({ queryKey: key });
    }
  };

  const ch = getChannel();
  const onMessage = (e: MessageEvent) => apply(e.data);
  ch?.addEventListener("message", onMessage);

  const onStorage = (e: StorageEvent) => {
    if (e.key !== STORAGE_KEY || !e.newValue) return;
    try {
      apply(JSON.parse(e.newValue));
    } catch {
      /* payload corrompido — ignora */
    }
  };
  window.addEventListener("storage", onStorage);

  // Ao voltar o foco para a aba, revalida o que pode ter mudado em outra aba
  // (cobre o caso do BroadcastChannel indisponível ou aba congelada).
  const onVisible = () => {
    if (document.visibilityState !== "visible") return;
    for (const key of RECOVERY_SYNC_KEYS) {
      void qc.invalidateQueries({ queryKey: [...key] });
    }
  };
  document.addEventListener("visibilitychange", onVisible);

  return () => {
    ch?.removeEventListener("message", onMessage);
    window.removeEventListener("storage", onStorage);
    document.removeEventListener("visibilitychange", onVisible);
  };
}
