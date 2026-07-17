import { createServerFn } from "@tanstack/react-start";
import { generateText, NoObjectGeneratedError, Output } from "ai";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createLovableAiGatewayProvider, getAiFallbackMessage } from "@/lib/ai-gateway.server";
import {
  AI_EXTRACTION_SYSTEM_PROMPT,
  ImportedWorkoutsResponseSchema,
  type ImportedWorkoutsResponse,
} from "@/lib/import-schema";

const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MB base64-decoded aprox
const MAX_TEXT_CHARS = 20_000;
const MAX_PDF_PAGES = 20;

const emptyResult: ImportedWorkoutsResponse = { sessions: [] };

function base64Bytes(b64: string) {
  return Math.floor(b64.length * 0.75);
}

async function callExtractor(
  content: Array<
    | { type: "text"; text: string }
    | { type: "image_url"; image_url: { url: string } }
  >,
): Promise<ImportedWorkoutsResponse> {
  const gateway = createLovableAiGatewayProvider();
  const model = gateway("google/gemini-2.5-flash");

  try {
    const { output } = await generateText({
      model,
      output: Output.object({ schema: ImportedWorkoutsResponseSchema }),
      messages: [
        { role: "system", content: AI_EXTRACTION_SYSTEM_PROMPT },
        { role: "user", content: content as any },
      ],
    });
    return output ?? emptyResult;
  } catch (error) {
    if (NoObjectGeneratedError.isInstance(error)) {
      // Retorna vazio em vez de estourar — UI mostra "nada detectado".
      return emptyResult;
    }
    const status = (error as any)?.statusCode ?? (error as any)?.status;
    // Erros de crédito / rate limit devem propagar como erro amigável.
    throw new Error(getAiFallbackMessage(error, "interpretar o treino") + (status ? ` (${status})` : ""));
  }
}

// -------- Foto --------
export const parseImageWorkout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        imageBase64: z.string().min(100),
        mime: z.enum(["image/jpeg", "image/png", "image/webp"]),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    if (base64Bytes(data.imageBase64) > MAX_IMAGE_BYTES) {
      throw new Error("Imagem maior que 10 MB.");
    }
    return callExtractor([
      { type: "text", text: "Extraia os treinos desta imagem." },
      { type: "image_url", image_url: { url: `data:${data.mime};base64,${data.imageBase64}` } },
    ]);
  });

// -------- PDF (páginas mistas) --------
export const parsePdfWorkout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        pages: z
          .array(
            z.object({
              text: z.string().optional(),
              imageBase64: z.string().optional(),
            }),
          )
          .min(1)
          .max(MAX_PDF_PAGES),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const content: Array<any> = [{ type: "text", text: "Extraia os treinos deste PDF (páginas abaixo)." }];
    for (const page of data.pages) {
      if (page.text) {
        content.push({ type: "text", text: page.text.slice(0, 4000) });
      } else if (page.imageBase64) {
        if (base64Bytes(page.imageBase64) > MAX_IMAGE_BYTES) {
          throw new Error("Uma das páginas do PDF é grande demais (>10 MB).");
        }
        content.push({
          type: "image_url",
          image_url: { url: `data:image/png;base64,${page.imageBase64}` },
        });
      }
    }
    return callExtractor(content);
  });

// -------- Texto livre --------
export const parseFreeTextWorkout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ text: z.string().min(3).max(MAX_TEXT_CHARS) }).parse(input),
  )
  .handler(async ({ data }) => {
    return callExtractor([
      { type: "text", text: `Extraia os treinos deste texto:\n\n${data.text}` },
    ]);
  });
