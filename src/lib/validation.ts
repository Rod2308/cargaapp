// Central place for input validation schemas.
// Every user-supplied string that hits the database goes through one of these
// before being sent. Client-side validation is UX + defense-in-depth; the
// authoritative security boundary is Postgres/RLS. React automatically
// escapes text nodes, so XSS via message content is not a concern; we still
// strip control characters and null bytes here to keep the DB clean.

import { z } from "zod";

/** Remove NUL, zero-width chars e caracteres de controle exceto \n \r \t. */
export function sanitizeText(input: string): string {
  return input
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .normalize("NFC");
}

const trimmed = (max: number) =>
  z
    .string()
    .transform((s) => sanitizeText(s).trim())
    .pipe(z.string().max(max, `Máximo de ${max} caracteres.`));

/** Chat / mensagens diretas — texto livre, até 4000 chars. */
export const messageSchema = trimmed(4000).pipe(
  z.string().min(1, "Mensagem vazia."),
);

/** Nome público / display_name — sem quebras de linha. */
export const displayNameSchema = trimmed(60)
  .pipe(z.string().min(1, "Informe um nome."))
  .transform((s) => s.replace(/\s+/g, " "));

/** Bio livre — permite quebras de linha. */
export const bioSchema = trimmed(500).transform((s) => (s.length ? s : null));

/** Campo curto opcional — cidade, especialidades, etc. */
export const shortTextSchema = trimmed(120).transform((s) =>
  s.length ? s : null,
);

/** CREF: dígitos + letra/UF, ex.: 123456-G/SP */
export const crefSchema = trimmed(20)
  .transform((s) => s.toUpperCase())
  .pipe(
    z
      .string()
      .regex(/^$|^[0-9A-Z]{2,10}[-/][A-Z0-9]{1,4}([-/][A-Z]{2})?$/i, "CREF inválido."),
  )
  .transform((s) => (s.length ? s : null));

/** Telefone brasileiro básico (apenas dígitos/espaços/parênteses/hífen). */
export const phoneSchema = trimmed(20)
  .pipe(
    z
      .string()
      .regex(/^$|^[+()\d\s-]{8,20}$/, "Telefone inválido."),
  )
  .transform((s) => (s.length ? s : null));

/** Código de convite CRG-XXXX. */
export const inviteCodeSchema = z
  .string()
  .transform((s) => sanitizeText(s).trim().toUpperCase())
  .pipe(z.string().regex(/^CRG-[A-Z0-9]{4,8}$/, "Código inválido."));

/** Email + senha para autenticação. */
export const emailSchema = z
  .string()
  .transform((s) => sanitizeText(s).trim().toLowerCase())
  .pipe(z.string().email("Email inválido.").max(254, "Email muito longo."));

export const passwordSchema = z
  .string()
  .min(8, "A senha precisa de pelo menos 8 caracteres.")
  .max(72, "Senha muito longa.");

/** Numérico com faixa — altura, peso, idade, etc. */
export const numberInRange = (min: number, max: number, label = "Valor") =>
  z
    .number({ invalid_type_error: `${label} inválido.` })
    .finite()
    .min(min, `${label} mínimo é ${min}.`)
    .max(max, `${label} máximo é ${max}.`);
