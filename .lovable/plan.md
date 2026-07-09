## Objetivo

Analisar as sessões concluídas de cada exercício e sugerir automaticamente ajustes de **carga (kg)** e **descanso (segundos)** para o próximo treino, mostrando um badge dentro do editor de treinos (`/app/treinos/$id`) e permitindo aplicar a sugestão com um clique.

## Como a sugestão é calculada (regra determinística, sem IA)

Para cada `workout_exercise`, olhamos as últimas **3 sessões** com séries registradas em `session_sets`:

**Carga (`target_weight_kg`)**
- Média das cargas das séries válidas de cada sessão → `avgLoad`.
- Média das reps por sessão → `avgReps`.
- Se `avgReps ≥ topoDaFaixa + 1` nas 2 últimas sessões → **subir 2,5 kg** (ou +5% se ≥40 kg).
- Se `avgReps < baseDaFaixa - 1` nas 2 últimas → **descer 5%**.
- Caso contrário → **manter**.
- Faixa lida de `target_reps` (aceita "8-12", "10", "AMRAP"; para AMRAP usa 8-12 como referência).

**Descanso (`target_rest_seconds`)**
- RPE médio (`session_sets.rpe`) das últimas 2 sessões:
  - RPE ≥ 9 → sugerir **+15s** (limite 240s).
  - RPE ≤ 6 → sugerir **-15s** (mínimo 30s, ou 45s p/ compostos).
  - Entre 7–8 → manter.
- Sem RPE registrado → não sugerir mudança de descanso.

**Sem dados suficientes** (menos de 2 sessões) → não gera sugestão, mostra "poucos dados ainda".

## Onde aparece

Dentro de `src/routes/_authenticated/app.treinos.$id.tsx`, em cada linha de exercício:

```text
Supino reto         3x8-12  ·  60s  ·  40kg
                    [ ↑ Subir p/ 42,5kg  ·  Manter descanso ]   ← chip clicável
```

- Chip verde para subir, âmbar para descer, cinza neutro para "manter".
- Tooltip mostra a base do cálculo: "Últimas 3 sessões: 10, 11, 12 reps @ 40kg".
- Clicar aplica o `UPDATE` em `workout_exercises` (mesma mutation que já existe para editar sets/reps).

Botão no topo do treino: **"Aplicar todas as sugestões"** — roda um `UPDATE` em lote para os exercícios com sugestão de mudança.

## Arquivos afetados

- **novo** `src/lib/progression.ts` — funções puras: `parseRepRange`, `analyzeExerciseHistory`, `suggestAdjustment`. Zero side-effects, 100% testável.
- **novo** `src/lib/progression.functions.ts` — `getWorkoutSuggestions({ workout_id })` server fn que:
  1. Busca `workout_exercises` do treino.
  2. Para cada um, busca as últimas ~15 `session_sets` via `session_id` das sessões do dono do treino.
  3. Aplica `suggestAdjustment` e devolve `{ workout_exercise_id, suggested_weight_kg, suggested_rest_seconds, reason, confidence }[]`.
- **editado** `src/routes/_authenticated/app.treinos.$id.tsx` — nova `useQuery` para sugestões + UI dos chips + mutation "aplicar" (individual e em lote).
- Sem migration, sem novas tabelas.

## Detalhes técnicos

- Query única: `session_sets.select("weight_kg, reps, rpe, workout_exercise_id, sessions!inner(started_at, user_id)").in("workout_exercise_id", ids).order("completed_at", desc).limit(200)`, agrupada em memória por `workout_exercise_id` e depois por `session_id`.
- Cálculos ficam em `progression.ts` para poder testar e reusar depois (ex.: em relatórios do trainer).
- Arredondamento: cargas em múltiplos de 2,5 kg; descanso em múltiplos de 15 s.
- Confidence: `low` (2 sessões), `medium` (3), `high` (3 com desvio-padrão baixo).
- RLS já cobre — só usamos o cliente do browser autenticado.
