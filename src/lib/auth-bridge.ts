/**
 * Ponte de login para origens que não estão na allow-list de redirect do backend.
 *
 * O provedor de autenticação só aceita redirecionar para a origem canônica
 * (https://cargaapp.lovable.app). Para permitir que uma cópia do app hospedada
 * em outra origem (ex.: Vercel) também faça login, o fluxo é:
 *
 *   1. origem espelho  → redireciona para CANONICAL_ORIGIN/auth?bridge=<origem>&next=<path>
 *   2. origem canônica → o usuário entra normalmente (email/senha ou Google)
 *   3. origem canônica → redireciona para <origem>/auth-bridge#access_token=...&refresh_token=...
 *   4. origem espelho  → /auth-bridge chama supabase.auth.setSession() e limpa o hash
 *
 * Os tokens viajam no fragmento (#) da URL — igual ao fluxo implícito do próprio
 * provedor — então nunca são enviados ao servidor nem gravados em logs de acesso.
 * A lista ALLOWED_BRIDGE_ORIGINS é fechada de propósito: qualquer outra origem é
 * rejeitada, para que a página canônica não possa ser usada para vazar sessão
 * para um domínio de terceiros.
 */

export const CANONICAL_ORIGIN = "https://cargaapp.lovable.app";

/** Origens espelho autorizadas a receber a sessão pela ponte. */
export const ALLOWED_BRIDGE_ORIGINS = ["https://cargaapp.vercel.app"] as const;

/** Caminho público que recebe a sessão na origem espelho. */
export const BRIDGE_CALLBACK_PATH = "/auth-bridge";

export function isAllowedBridgeOrigin(origin: string | null | undefined): boolean {
  if (!origin) return false;
  return (ALLOWED_BRIDGE_ORIGINS as readonly string[]).includes(origin);
}

/** true quando o app está rodando numa origem espelho que precisa da ponte. */
export function isBridgeOrigin(): boolean {
  if (typeof window === "undefined") return false;
  const origin = window.location.origin;
  return origin !== CANONICAL_ORIGIN && isAllowedBridgeOrigin(origin);
}

/** Sanitiza um destino interno (evita open redirect e URLs absolutas). */
export function safeNextPath(next: unknown): string {
  if (typeof next !== "string") return "";
  if (!next.startsWith("/") || next.startsWith("//")) return "";
  return next;
}

/**
 * Verifica se uma origem está acessível antes de redirecionar para ela.
 * Usa `no-cors` (resposta opaca) só para saber se a rede/host respondem —
 * qualquer falha ou estouro de tempo devolve false.
 */
export async function probeOrigin(origin: string, timeoutMs = 7000): Promise<boolean> {
  if (typeof fetch === "undefined") return true;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    await fetch(`${origin}/favicon.png?ping=${Date.now()}`, {
      mode: "no-cors",
      cache: "no-store",
      credentials: "omit",
      signal: controller.signal,
    });
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Manda o usuário da origem espelho para a tela de login canônica.
 * Antes checa se o domínio canônico responde; se não responder (offline,
 * DNS/rede falhando ou muito lento), devolve false e NÃO navega — quem chamou
 * mostra a tela "Não conseguimos conectar" do próprio app.
 */
export async function redirectToCanonicalLogin(next: string): Promise<boolean> {
  const url = new URL("/auth", CANONICAL_ORIGIN);
  url.searchParams.set("bridge", window.location.origin);
  const safe = safeNextPath(next);
  if (safe) url.searchParams.set("next", safe);
  const reachable = await probeOrigin(CANONICAL_ORIGIN);
  if (!reachable) return false;
  window.location.replace(url.toString());
  return true;
}


/**
 * Na origem canônica: devolve a sessão para a origem espelho.
 * Retorna false quando a origem não é autorizada (nada é enviado).
 */
export function handOffSessionToBridge(
  bridgeOrigin: string,
  session: { access_token: string; refresh_token: string },
  next: string,
): boolean {
  if (!isAllowedBridgeOrigin(bridgeOrigin)) return false;
  const params = new URLSearchParams({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
  });
  const safe = safeNextPath(next);
  if (safe) params.set("next", safe);
  window.location.replace(`${bridgeOrigin}${BRIDGE_CALLBACK_PATH}#${params.toString()}`);
  return true;
}
