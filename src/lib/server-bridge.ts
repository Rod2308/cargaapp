// Chamada unificada de funções do servidor.
//
// No domínio canônico as server functions existem e são chamadas direto.
// No domínio espelho (site estático) elas não existem: a chamada é feita para
// a rota-ponte da origem canônica, que executa exatamente o mesmo código.
// Assim os dois domínios têm as mesmas funções e o mesmo comportamento.

import { supabase } from "@/integrations/supabase/client";
import { CANONICAL_ORIGIN, isBridgeOrigin } from "@/lib/auth-bridge";

const BRIDGE_URL = `${CANONICAL_ORIGIN}/api/public/bridge`;

async function callBridge<T>(action: string, payload?: unknown): Promise<T> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;

  const res = await fetch(BRIDGE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ action, payload: payload ?? null }),
  });

  let json: { result?: unknown; error?: string } = {};
  try {
    json = (await res.json()) as { result?: unknown; error?: string };
  } catch {
    // resposta não-JSON
  }
  if (!res.ok) throw new Error(json.error || `Falha na requisição (${res.status})`);
  return json.result as T;
}

/** Erros que indicam "server function não existe nesta hospedagem". */
function looksUnavailable(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err ?? "");
  return (
    /not a function|Unexpected token|<!DOCTYPE|404|Failed to fetch|NetworkError|Server function/i.test(
      msg,
    ) || err instanceof SyntaxError
  );
}

/**
 * Executa a server function local; se a hospedagem não tiver server functions
 * (domínio espelho), usa a ponte na origem canônica.
 */
export async function callServer<T>(
  action: string,
  localFn: (payload?: any) => Promise<T>,
  payload?: unknown,
): Promise<T> {
  if (isBridgeOrigin()) return callBridge<T>(action, payload);
  try {
    return payload === undefined ? await localFn() : await localFn({ data: payload } as any);
  } catch (err) {
    if (looksUnavailable(err)) return callBridge<T>(action, payload);
    throw err;
  }
}

/**
 * Envolve uma server function preservando a assinatura original
 * (`fn()` ou `fn({ data })`) e adicionando o fallback pela ponte.
 * Substitui `useServerFn` nos pontos de chamada.
 */
export function bridged<F extends (...args: any[]) => Promise<any>>(action: string, localFn: F): F {
  return ((args?: any) => callServer(action, localFn as any, args?.data)) as F;
}
