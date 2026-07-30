# Modo Offline — Evolução do sistema atual (auditado)

> Revisado após auditoria do código existente. **Não vamos reconstruir do zero.**
> O app já tem uma base offline funcional; o plano agora é evoluí-la.

## O que JÁ existe hoje (auditoria)

| Peça | Arquivo | Estado |
|---|---|---|
| Fila de escrita offline (IndexedDB via `idb-keyval`) | `src/lib/offline-queue.ts` | Funciona: FIFO, flush em `online`/`focus`/30s, idempotência por `client_mutation_id` |
| Helpers de escrita "atravessa fila" | `src/lib/offline-writes.ts` | Funciona: insert/upsert/update/delete com fallback automático para a fila |
| Cache de leitura offline | `src/lib/query-persister.ts` | Funciona: persiste o cache do React Query em IndexedDB (30 dias) |
| Pré-carga de dados essenciais | `src/lib/offline-prefetch.ts` | Funciona |
| Banner de status + pendentes | `src/components/SyncStatus.tsx` | Funciona, com ping real de rede (`useOnline`) |
| Aviso "precisa de internet" | `src/components/OfflineNotice.tsx` | Funciona |
| Snapshot da sessão em andamento | `src/lib/session-persist.ts` | Funciona |
| Coluna `client_mutation_id` UNIQUE | migration já aplicada | Feito |

## Decisão sobre Dexie / tabelas `cache_*`

**Não implementar agora.** O `idb-keyval` + persister do React Query já cobre
leitura e escrita offline com volume atual (dezenas de treinos, ~30 sessões,
~100 mensagens por conversa). Dexie só se justifica quando precisarmos de
consultas indexadas locais (filtro/ordenção por data direto no IndexedDB) ou
quando o blob único do cache passar de ~5 MB.

**Gatilhos para reavaliar Dexie:**
- cache serializado do React Query > 5 MB (medir com `navigator.storage.estimate()`);
- necessidade de busca/paginação local em histórico longo;
- perda de performance no throttle de gravação (hoje 1,5 s).

## O que falta (backlog priorizado)

1. **Falhas permanentes visíveis** — *feito*: ops que falham por RLS/constraint
   vão para `failed_ops` persistido, com badge "N alterações não sincronizaram",
   detalhe do erro e botões tentar de novo / descartar.
2. **`PendingBadge` nos itens** — marcar visualmente itens criados offline
   (`_pending` já é devolvido por `writeInsert`).
3. **Detecção de conflito por `updated_at`** — hoje o último write vence.
4. **Backoff exponencial** no flush (hoje intervalo fixo de 30 s).
5. **Limpeza de cache ao trocar de conta** (evitar vazamento entre usuários).
6. **Migrar escritas restantes** para `offline-writes` (medidas, grupos, perfil).

## Fora de escopo

- Sincronização colaborativa em tempo real offline (chat/ranking de grupo).
- Cache offline de imagens de exercícios.
