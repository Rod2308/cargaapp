/**
 * Utilitários da página de status do login (/status-login).
 *
 * Objetivo: confirmar automaticamente, em cada origem (canônica e espelho),
 * se a sessão chegou e se ela veio pela ponte de autenticação.
 *
 * O marcador é gravado por origem no localStorage — não existe leitura
 * cross-origin de storage, então cada domínio confirma o seu próprio estado
 * e a página oferece o link para repetir a checagem no outro domínio.
 */

import { ALLOWED_BRIDGE_ORIGINS, CANONICAL_ORIGIN } from "@/lib/auth-bridge";

const MARKER_KEY = "carga.login-check.marker";
const CHECKLIST_KEY = "carga.login-check.checklist";

export type LoginMarker = {
  /** "bridge" = sessão recebida via /auth-bridge; "direct" = login na própria origem. */
  via: "bridge" | "direct";
  origin: string;
  at: string;
};

export function recordLoginMarker(via: LoginMarker["via"]): void {
  if (typeof window === "undefined") return;
  try {
    const marker: LoginMarker = { via, origin: window.location.origin, at: new Date().toISOString() };
    window.localStorage.setItem(MARKER_KEY, JSON.stringify(marker));
  } catch {
    /* storage indisponível (modo privado): checagem apenas não fica persistida */
  }
}

export function readLoginMarker(): LoginMarker | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(MARKER_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<LoginMarker>;
    if (parsed?.via !== "bridge" && parsed?.via !== "direct") return null;
    if (typeof parsed.origin !== "string" || typeof parsed.at !== "string") return null;
    return { via: parsed.via, origin: parsed.origin, at: parsed.at };
  } catch {
    return null;
  }
}

export function clearLoginMarker(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(MARKER_KEY);
  } catch {
    /* noop */
  }
}

export type OriginKind = "canonical" | "mirror" | "other";

export function originKind(origin: string): OriginKind {
  if (origin === CANONICAL_ORIGIN) return "canonical";
  if ((ALLOWED_BRIDGE_ORIGINS as readonly string[]).includes(origin)) return "mirror";
  return "other";
}

/** Origens que devem ser testadas no checklist (canônica + espelhos). */
export function targetOrigins(): string[] {
  return [CANONICAL_ORIGIN, ...ALLOWED_BRIDGE_ORIGINS];
}

/**
 * Verifica se a página de retorno da ponte responde na origem informada.
 * Usa `no-cors` porque a resposta é de outro domínio: só interessa saber se
 * a requisição completou (resposta opaca) ou falhou (rede/404 de domínio).
 */
export async function probeBridgeEndpoint(origin: string, timeoutMs = 6000): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    await fetch(`${origin}/auth-bridge`, {
      method: "GET",
      mode: "no-cors",
      cache: "no-store",
      redirect: "follow",
      signal: controller.signal,
    });
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

/** Itens de teste manual do fluxo de login (persistidos por origem). */
export const MANUAL_CHECKLIST: { id: string; label: string; hint: string }[] = [
  {
    id: "email-canonical",
    label: "Entrar com e-mail/senha no domínio principal",
    hint: `Abra ${CANONICAL_ORIGIN}/auth, entre e confirme que caiu em /app.`,
  },
  {
    id: "google-canonical",
    label: "Entrar com Google no domínio principal",
    hint: "O botão do Google deve voltar autenticado, sem passar pela tela de login de novo.",
  },
  {
    id: "email-mirror",
    label: "Entrar com e-mail/senha no domínio espelho",
    hint: `Abra ${ALLOWED_BRIDGE_ORIGINS[0]}/auth: o login roda no domínio principal e a sessão volta pela ponte.`,
  },
  {
    id: "google-mirror",
    label: "Entrar com Google no domínio espelho",
    hint: "Deve terminar autenticado no espelho, com a URL limpa (sem tokens no endereço).",
  },
  {
    id: "reload",
    label: "Recarregar /app já logado",
    hint: "Um F5 em /app não pode devolver você para a tela de login.",
  },
  {
    id: "remember",
    label: 'Testar o "Lembrar-me"',
    hint: "Com a opção ligada, fechar e reabrir o navegador mantém a sessão; desligada, não mantém.",
  },
  {
    id: "reset",
    label: "Recuperar senha (esqueci a senha)",
    hint: "O link do e-mail deve abrir /reset-password e aceitar a nova senha.",
  },
  {
    id: "logout",
    label: "Sair e confirmar bloqueio",
    hint: "Depois do logout, abrir /app direto deve mandar para /auth.",
  },
];

export function readChecklist(): Record<string, boolean> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(CHECKLIST_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const out: Record<string, boolean> = {};
    for (const item of MANUAL_CHECKLIST) {
      if (parsed[item.id] === true) out[item.id] = true;
    }
    return out;
  } catch {
    return {};
  }
}

export function saveChecklist(state: Record<string, boolean>): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CHECKLIST_KEY, JSON.stringify(state));
  } catch {
    /* noop */
  }
}
