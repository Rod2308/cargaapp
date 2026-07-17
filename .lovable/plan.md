## Objetivo

Card "Sugestão de hoje" no dashboard que decide o treino do dia a partir de uma função pura em TypeScript — combinando histórico de treinos formais, atividades extras (esportes/cardio), check-in diário e regras de recuperação. Zero IA, zero chamada externa.

## O que o usuário vê

Na tela inicial (`/app`), logo acima de "Meus treinos":

1. **Se ainda não fez check-in hoje**: card compacto pedindo os 4 números (sono h, qualidade 1-5, dor 1-5, energia 1-5), com botão "Salvar check-in".
2. **Depois do check-in**: card com
   - **Título**: "Sugestão de hoje"
   - **Grupo/tipo em destaque**: ex. "Peito + Tríceps · Força"
   - **Badge de intensidade**: Leve (verde) / Moderada (âmbar) / Alta (vermelho) / Descanso (cinza)
   - **Frase explicativa** com dados reais: "Você jogou futebol ontem, pernas ainda cansadas — hoje foco em parte superior."
   - **Score de recuperação** 0-10 e detalhes expansíveis ("Como calculei")
   - **Botão "Iniciar este treino"** que abre o treino do plano cujo `label`/exercícios mais casam com o grupo sugerido, ou o modal de "esporte/atividade avulsa" quando a sugestão é descanso ativo/cardio leve.

Se o usuário for novo (menos de 3 sessões registradas), o card mostra sugestão padrão (full body moderado) com aviso "vai ficar mais preciso conforme você registrar treinos".

## Arquivos

**Migration** (nova tabela)
- `daily_checkins` — `user_id`, `log_date` (unique com user), `sleep_hours numeric`, `sleep_quality int 1-5`, `soreness int 1-5`, `energy int 1-5`, `created_at`. RLS: dono lê/escreve. GRANT `authenticated` + `service_role`.

**Novo** `src/lib/daily-suggestion.ts` — função pura, testável, sem side-effects:
- `MUSCLE_RECOVERY_DAYS` (peito 2, costas 2, pernas 3, ombro 2, bíceps 1, tríceps 1, glúteo 2, abdômen 1)
- `ACTIVITY_IMPACT_MAP`: mapa `activity_name → { grupo: "alto"|"medio"|"baixo" }[]` para futebol, vôlei, corrida, caminhada, natação, ciclismo (usa o mesmo nome que já está em `exercises` grupo "Esportes").
- `combineTimeline(sessoes, atividadesExtras)` → linha do tempo unificada de 7 dias com `{ date, impactoPorGrupo, cardioMinutes }`.
- `diasDesdeUltimoEsforco(timeline, grupo)` → considera impacto médio/alto como reset.
- `cargaCardioSemana(timeline)` → soma minutos de cardio médio/alto; flag `alta` se ≥ 3 sessões intensas.
- `scoreRecuperacao(checkin)` → 0-10 com pesos (sono h ×3 normalizado até 8h, qualidade ×3, dor invertida ×2, energia ×2).
- `sugerirTreinoDoDia({ sessoes, atividadesExtras, checkin, hoje })` → aplica regras (a-f do brief) e retorna `{ tipo, grupos, intensidade, motivo, score, gruposLiberados, cardioCarga, sugerirWorkoutId? }`.

**Novo** `src/components/DailyCheckinCard.tsx` — form controlado (4 campos) + mutation upsert. Zod: `sleep_hours` 0-24, restantes 1-5.

**Novo** `src/components/DailySuggestionCard.tsx` — recebe o resultado da função, renderiza estado vazio (sem check-in), estado usuário novo, ou sugestão completa. Botão "Iniciar" chama a mesma `startSession` mutation já existente no dashboard, escolhendo o workout do plano cujos exercícios mais cobrem os grupos sugeridos.

**Editado** `src/routes/_authenticated/app.index.tsx`:
- Novas queries: `daily-checkin` (dia atual), `all-sessions-7d` (com `session_sets → exercises.muscle_group`), `extra-activities-7d` (sessões `workout_id is null` com `exercise.muscle_group='Esportes'`).
- Renderiza `<DailyCheckinCard>` OU `<DailySuggestionCard>` logo após o card de recuperação.

## Fluxo de dados

```text
sessions (formais, com session_sets → exercises.muscle_group)
sessions (extras, workout_id null, session_sets → exercises "Esportes")
daily_checkins (hoje)
                    │
                    ▼
          sugerirTreinoDoDia() ← função pura
                    │
                    ▼
         DailySuggestionCard renderiza
                    │
                    ▼
    onClick → startSession(workoutSugerido) já existente
```

## Regras de decisão (ordem)

1. score ≤ 4 OU dor ≥ 4 OU ≥ 6 dias de esforço na semana → **descanso ativo, leve**
2. score 4–6 → **funcional leve** num grupo liberado e não impactado por extra recente
3. score > 6 → **força** no grupo liberado com mais dias parado; alta se score ≥ 8, senão moderada
4. Se pernas foram exigidas por extra intenso nas últimas 48h → nunca sugerir pernas (força upper body)
5. Nenhum grupo liberado + score bom → **cardio leve** (respeitando `cargaCardioSemana`) ou mobilidade

## Segurança e validação

- Zod nos inputs do check-in (client e server via `upsert`).
- RLS + GRANT explícitos na nova tabela.
- Nenhum dado do check-in em URLs ou logs.

## Fora de escopo desta entrega

- Histórico de check-ins e gráficos (só o dia atual + upsert por data).
- Editar o mapa de impacto pela UI (fica hard-coded em `daily-suggestion.ts`).
- Ajuste automático da intensidade dentro do workout do plano — o botão "Iniciar" apenas leva ao workout mais adequado; ajuste fino continua no editor de treino existente.
