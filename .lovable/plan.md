# Modo Offline Completo — Fila de Sincronização

Transformar o Carga num app que continua funcionando 100% quando a internet cai: você navega, cria treinos, marca séries, manda mensagem — e tudo sincroniza sozinho quando a conexão volta.

## O que você vai ganhar

- **Abrir o app offline**: telas, últimos treinos e histórico ficam em cache local.
- **Criar/editar offline**: novos treinos, séries, sessões, check-ins diários e mensagens entram numa fila.
- **Sincronização automática**: quando volta a internet, a fila envia tudo em ordem e você vê um badge "Sincronizando… X pendentes".
- **Indicador visual**: cada item criado offline mostra um ícone "⏳ pendente" até sincronizar.
- **Resolução de conflitos**: se o mesmo registro foi alterado no servidor, você é avisado e decide (manter o seu / usar o do servidor).

## O que fica offline (leitura)

Cache local no IndexedDB, atualizado a cada abertura online:
- Seus treinos e exercícios (todos)
- Últimas 30 sessões + séries
- Perfil, preferências, grupos que você participa
- Últimas 100 mensagens de cada conversa/grupo

## O que fica na fila (escrita)

Operações que geram um item na fila offline:
- Iniciar/finalizar sessão de treino
- Adicionar/editar/remover série
- Criar/editar/excluir treino e exercício do treino
- Check-in diário, sono, desconforto
- Enviar mensagem (DM ou grupo)
- Editar perfil

Operações que **exigem internet** (mostram aviso claro):
- Login/cadastro
- Entrar em grupo por código, aceitar convite
- Importar arquivo `.fit`/plano (parse é local, mas salvar precisa de rede)
- Push notifications (chegam só online)
- Ranking em tempo real do grupo

## Como funciona por dentro (técnico)

```text
┌─────────────┐   escrita    ┌──────────────┐
│  Componente │ ───────────► │  offline-db  │  IndexedDB local
└─────────────┘              │  (Dexie)     │  ├─ cache_*   (leitura)
       ▲                     │              │  └─ mutations (fila)
       │ lê                  └──────┬───────┘
       │                            │ quando online
       │                            ▼
       │                     ┌──────────────┐
       └──── sync ◄───────── │ sync-engine  │ ──► Supabase
                             └──────────────┘
```

**Componentes novos:**
1. `src/lib/offline-db.ts` — Dexie (wrapper amigável do IndexedDB) com tabelas `mutations`, `cache_workouts`, `cache_sessions`, `cache_messages`, etc.
2. `src/lib/sync-engine.ts` — worker que processa a fila em ordem FIFO, com retry exponencial e detecção de conflito por `updated_at`.
3. `src/hooks/useOfflineMutation.ts` — substituto do `useMutation` que grava na fila se offline, direto se online.
4. `src/hooks/useOfflineQuery.ts` — wrapper do `useQuery` que devolve dado do cache quando offline.
5. `src/components/SyncBadge.tsx` — mostra "N pendentes • sincronizando…" no header.
6. `src/components/PendingBadge.tsx` — ícone ⏳ em cada item ainda não sincronizado.

**Backend:**
- Adicionar coluna `client_mutation_id uuid` nas tabelas de escrita (sessions, session_sets, workouts, workout_exercises, messages, group_messages, daily_checkins, sleep_logs) com `UNIQUE` — garante idempotência (se o retry duplicar, o servidor ignora).
- Migration única com `ADD COLUMN IF NOT EXISTS` + índice único.

**Escopo dos dados em cache:** só do usuário logado. Ao trocar de conta, o cache é limpo.

## Fora de escopo (fica pra depois se quiser)

- Sincronização entre múltiplos dispositivos do mesmo usuário em tempo real offline.
- Cache offline de imagens grandes de exercícios (só metadados).
- Ranking e chat de grupo em modo offline colaborativo.

## Entrega em 3 passos

1. **Infra base**: Dexie + offline-db + sync-engine + SyncBadge + migration `client_mutation_id`.
2. **Migração das escritas críticas**: sessão de treino, séries, check-in, perfil (o fluxo que você mais usa).
3. **Migração das demais**: workouts, mensagens, sleep_logs + PendingBadge nos itens.

Posso começar pelo passo 1 agora. Confirma?