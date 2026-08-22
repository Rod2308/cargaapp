import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { routeAiRequest } from "./ai-router.server";

const WorkoutAiInput = z.object({
  goal: z.string(),
  daysPerWeek: z.number().min(1).max(7),
  experienceLevel: z.enum(["beginner", "intermediate", "advanced"]),
  priorities: z.array(z.string()),
  equipment: z.enum(["gym", "dumbbells", "bodyweight"]),
});

export const generateWorkoutPlan = createServerFn({ method: "POST" })
  .validator((data: unknown) => WorkoutAiInput.parse(data))
  .handler(async ({ data, context }) => {
    // Nota: O userId vem do middleware de auth se disponível,
    // mas aqui vamos assumir que routeAiRequest lida com fallback se não houver context.userId
    const userId = (context as any).userId;
    
    if (!userId) throw new Error("Usuário não autenticado");

    const systemPrompt = `
      Você é um treinador de elite. Crie um plano de treino altamente estruturado.
      Responda EXCLUSIVAMENTE em JSON no formato:
      {
        "name": "Nome do Plano",
        "description": "Breve explicação da estratégia",
        "workouts": [
          {
            "name": "Treino A - Foco em X",
            "exercises": [
              {
                "name": "Nome do Exercício",
                "sets": 3,
                "reps": "8-12",
                "rest": 90,
                "muscle_group": "Peito"
              }
            ]
          }
        ]
      }
      Use nomes de exercícios em Português.
    `;

    const userPrompt = `
      Objetivo: ${data.goal}
      Dias por semana: ${data.daysPerWeek}
      Nível: ${data.experienceLevel}
      Prioridades: ${data.priorities.join(", ")}
      Equipamentos: ${data.equipment === "gym" ? "Academia completa" : data.equipment === "dumbbells" ? "Halteres apenas" : "Peso do corpo"}
    `;

    return await routeAiRequest(userId, {
      systemPrompt,
      userPrompt,
      jsonMode: true,
    });
  });
