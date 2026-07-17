import { z } from "zod";

/**
 * Schema compartilhado entre server functions (IA) e UI de revisão.
 * Uma "ImportedSession" pode ser cardio (distância, tempo) ou força (exercícios com séries).
 */

export const ImportedSetSchema = z.object({
  reps: z.number().int().nullable(),
  weight_kg: z.number().nullable(),
});
export type ImportedSet = z.infer<typeof ImportedSetSchema>;

export const ImportedExerciseSchema = z.object({
  name: z.string(),
  sets: z.array(ImportedSetSchema),
  notes: z.string().nullable(),
});
export type ImportedExercise = z.infer<typeof ImportedExerciseSchema>;

export const ImportedSessionSchema = z.object({
  // Data (ISO YYYY-MM-DD) — hora opcional. Se não houver, a UI pergunta ou usa hoje.
  date: z.string().nullable(),
  time: z.string().nullable(), // "HH:MM"
  title: z.string().nullable(),
  activity_type: z.string().nullable(), // "running" | "cycling" | "strength" | ...
  duration_min: z.number().nullable(),
  distance_m: z.number().nullable(),
  avg_hr: z.number().nullable(),
  max_hr: z.number().nullable(),
  calories: z.number().nullable(),
  elevation_gain_m: z.number().nullable(),
  elevation_loss_m: z.number().nullable(),
  notes: z.string().nullable(),
  exercises: z.array(ImportedExerciseSchema),
});
export type ImportedSession = z.infer<typeof ImportedSessionSchema>;

export const ImportedWorkoutsResponseSchema = z.object({
  sessions: z.array(ImportedSessionSchema),
});
export type ImportedWorkoutsResponse = z.infer<typeof ImportedWorkoutsResponseSchema>;

export const AI_EXTRACTION_SYSTEM_PROMPT = `Você é um extrator de dados de treino. Sua tarefa é ler o conteúdo (imagem, PDF ou texto livre) e devolver um JSON estruturado com as sessões de treino identificadas.

Regras:
- Sempre devolva { "sessions": [...] } mesmo que só tenha um treino.
- date no formato "AAAA-MM-DD" quando conseguir inferir. Se o texto disser "seg", "ter", etc. sem data absoluta, deixe null.
- time no formato "HH:MM" (24h) ou null.
- distance_m em METROS (converta km->metros, mi->metros com 1609.34).
- weight_kg em QUILOS (converta lb->kg com 0.453592).
- duration_min em MINUTOS (converta "1h20min" -> 80).
- activity_type: "running", "cycling", "swimming", "walking", "strength", "hiit", "yoga" ou similar em inglês minúsculo. Use "strength" quando houver exercícios com séries/repetições.
- exercises: só preencha para treinos de força. Cada set tem reps e weight_kg (weight_kg pode ser null para peso do corpo).
- Se um campo não estiver claramente no conteúdo, use null. NUNCA invente valores.
- Se não conseguir identificar nenhum treino, devolva { "sessions": [] }.`;
