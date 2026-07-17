
## O que já existe hoje
- Import de arquivo **.fit/.gpx/.tcx** funcional (`ImportWorkoutDialog` + `workout-file-parser.ts`) extraindo data, duração, distância, FC média/máx e calorias.
- Import de **texto livre** para *planos de treino* (`ImportWorkoutPlanDialog`) — cria treinos A/B/C, não sessões do histórico.

## O que vou construir

### 1. Novo hub "Importar treino"
Um único diálogo com 4 abas (Arquivo / Foto / PDF / Texto), acessível por um botão destacado no Dashboard e em Histórico. As abas de Arquivo e Texto reaproveitam os diálogos que já existem, agora unificados na mesma janela.

### 2. Enriquecer o parser de arquivo (GPX/TCX/FIT)
- Extrair também **elevação (ganho/perda)** e **rota (lat/long)**.
- Guardar a rota como GeoJSON num novo campo `sessions.route_geojson` para exibir no futuro em mapa.
- Adicionar `elevation_gain_m` / `elevation_loss_m` ao schema.

### 3. Foto do treino (nova aba)
- Upload JPG/PNG (HEIC não é suportado por navegadores; vou avisar e sugerir converter).
- Envia a imagem via server function para o **Lovable AI Gateway** usando um modelo de visão (`google/gemini-3.1-flash-image` como entrada + saída estruturada) com prompt em pt-BR pedindo JSON de exercícios/séries/reps/carga/distância/tempo.
- Retorna prévia editável antes de salvar.

### 4. PDF (nova aba)
- Extrai texto no cliente com `pdfjs-dist` (funciona no browser, sem Node).
- Se o PDF não tiver texto (escaneado), manda as **páginas renderizadas como imagem** para o mesmo endpoint de visão.
- Interpreta com IA → JSON estruturado → prévia editável.

### 5. Texto livre para *sessões* (nova aba, distinta da de plano)
- Campo grande onde o usuário cola algo como `"seg: corrida 5km 25min / qua: agachamento 4x10 80kg"`.
- Envia para server function com IA, que devolve lista de sessões estruturadas por data.

### 6. Tela unificada de revisão
Um componente único `ImportReviewSheet` mostrando cada sessão detectada como um card editável:
- Data/hora, tipo, duração, distância, FC, calorias, elevação, exercícios (nome/séries/reps/carga).
- Checkbox para incluir/excluir por item.
- Badge **"Duplicado"** quando já existe sessão do mesmo usuário com mesma data/hora ±5min.
- Botão único "Salvar N treinos" que insere em `sessions` (e `session_sets` quando houver exercícios de força).

### 7. Deduplicação e metadados
- Query prévia dos `started_at` do usuário na janela relevante para marcar duplicatas.
- Novo campo `sessions.import_source` (`"file:strava.gpx"`, `"photo"`, `"pdf:plan.pdf"`, `"text"`) para rastreabilidade.

### 8. Unidades
- Ler `profiles.units_distance` (km/mi) e `units_weight` (kg/lb) para converter na exibição da prévia. O storage continua em SI (metros, kg).
- Se essas colunas não existirem, adiciono via migração com default `km`/`kg`.

## Detalhes técnicos

**Schema (uma migração):**
```
ALTER TABLE public.sessions
  ADD COLUMN elevation_gain_m int,
  ADD COLUMN elevation_loss_m int,
  ADD COLUMN route_geojson jsonb,
  ADD COLUMN import_source text;

ALTER TABLE public.profiles
  ADD COLUMN units_distance text DEFAULT 'km',
  ADD COLUMN units_weight   text DEFAULT 'kg';
```

**Server functions novas (em `src/lib/import.functions.ts`):**
- `parseImageWorkout({ imageBase64, mime })` → chama Gateway com `google/gemini-3.1-flash-image` + `Output.object(schema)`.
- `parsePdfWorkout({ pages: Array<{ text?: string; imageBase64?: string }> })` → usa `google/gemini-2.5-flash` para páginas com texto, visão para as sem.
- `parseFreeTextWorkout({ text })` → mesmo modelo, prompt específico de texto.
Todas usam `requireSupabaseAuth`, validam tamanho (≤10 MB por imagem, ≤20 páginas por PDF) e sanitizam erros.

**Dependências novas:**
- `pdfjs-dist` (parse de PDF no cliente, funciona no browser).
- Nada mais — visão vai pelo Gateway já configurado.

**Arquivos novos:**
- `src/components/ImportHub.tsx` (diálogo com abas)
- `src/components/ImportPhotoTab.tsx`
- `src/components/ImportPdfTab.tsx`
- `src/components/ImportFreeTextTab.tsx`
- `src/components/ImportReviewSheet.tsx`
- `src/lib/import.functions.ts`
- `src/lib/import-schema.ts` (Zod schema compartilhado)
- `src/lib/pdf-extract.ts` (client-side)

**Arquivos alterados:**
- `src/lib/workout-file-parser.ts` (elevação + rota)
- `src/components/ImportWorkoutDialog.tsx` (vira aba "Arquivo" dentro do hub)
- `src/routes/_authenticated/app.index.tsx` e `app.historico.tsx` (troca botão antigo pelo hub)
- `src/routes/_authenticated/app.perfil.tsx` (seletor de unidades)

## Como planejo trabalhar
Vou fazer tudo em uma única leva — não vou dividir em PRs. O escopo é grande mas os pedaços têm baixa dependência entre si: schema primeiro, depois server functions de IA em paralelo com o hub UI, depois a tela de revisão que costura tudo, depois enriquecimento do parser de arquivo.

## Confirme antes de eu começar
1. **OK usar Lovable AI para visão/PDF?** Consome créditos do seu workspace a cada import de foto/PDF/texto.
2. **HEIC**: OK avisar o usuário para converter para JPG/PNG (não há parser de HEIC viável no browser sem trazer >1 MB de wasm)?
3. **Deduplicação**: janela de ±5 minutos na mesma data está bom, ou prefere só bloquear duplicata exata?
