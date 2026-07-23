// Persiste o cache do React Query em IndexedDB para que qualquer tela já
// aberta ao menos uma vez continue funcionando offline (leitura). Escritas
// continuam pela offline-queue.

import type { QueryClient } from "@tanstack/react-query";
import { persistQueryClient } from "@tanstack/react-query-persist-client";
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import { get, set, del } from "idb-keyval";

const BUSTER = "carga-v1";

export function setupQueryPersister(queryClient: QueryClient) {
  if (typeof window === "undefined") return;

  const persister = createAsyncStoragePersister({
    storage: {
      getItem: (key) => get<string>(key).then((v) => v ?? null),
      setItem: (key, value) => set(key, value),
      removeItem: (key) => del(key),
    },
    key: "carga-query-cache",
    throttleTime: 1500,
  });

  persistQueryClient({
    // Peer duplicado do @tanstack/query-core entre pacotes; cast seguro.
    queryClient: queryClient as unknown as Parameters<typeof persistQueryClient>[0]["queryClient"],
    persister,
    maxAge: 1000 * 60 * 60 * 24 * 30, // 30 dias
    buster: BUSTER,
    dehydrateOptions: {
      // Só persiste queries que já resolveram com dados — evita gravar erros.
      shouldDehydrateQuery: (q) => q.state.status === "success",
    },
  });
}
