/**
 * Logout único do app — usado no Perfil e na página de status.
 *
 * Requisitos que este fluxo cobre:
 * 1. Invalida a sessão no servidor (scope "global": revoga os refresh tokens),
 *    com fallback local quando não há rede.
 * 2. Limpa TODO estado local que poderia deixar o usuário "meio logado":
 *    cache do React Query, tokens do Supabase em localStorage E sessionStorage
 *    (o modo "Lembrar-me desligado" guarda o token em sessionStorage),
 *    marcas do "Lembrar-me" e o marcador de login de /status-login.
 * 3. Redireciona com replace (o botão Voltar não pode restaurar a área logada)
 *    e com recarga completa da página, para não sobrar nada em memória.
 *
 * Funciona igual nas duas origens: o destino é sempre /auth da MESMA origem.
 * No domínio espelho (.vercel.app), a própria tela /auth reencaminha para o
 * login canônico pela ponte quando o usuário decidir entrar de novo.
 */

import type { QueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { clearLoginMarker } from "@/lib/login-check";

const TEMP_FLAG = "carga_temp_session";
const REMEMBER_FLAG = "carga_remember_me";

/** Remove qualquer token de autenticação persistido nesta origem. */
function purgeLocalSession() {
  if (typeof window === "undefined") return;
  for (const store of [window.localStorage, window.sessionStorage]) {
    try {
      const keys: string[] = [];
      for (let i = 0; i < store.length; i++) {
        const k = store.key(i);
        // Tokens do Supabase: sb-<ref>-auth-token (e variantes com sufixo).
        if (k && (k.startsWith("sb-") || k === TEMP_FLAG)) keys.push(k);
      }
      for (const k of keys) store.removeItem(k);
    } catch {
      /* storage indisponível — segue o logout */
    }
  }
  try {
    // Mantém a preferência de UI apenas se o usuário quis ser lembrado.
    if (window.localStorage.getItem(REMEMBER_FLAG) === "0") {
      window.localStorage.removeItem(REMEMBER_FLAG);
    }
  } catch {
    /* noop */
  }
  clearLoginMarker();
}

export type LogoutOptions = {
  /** Caminho interno de destino após sair (default: /auth). */
  to?: string;
  /** Desativa o push deste dispositivo antes de sair. */
  unsubscribePush?: boolean;
};

export async function performLogout(qc?: QueryClient, options: LogoutOptions = {}): Promise<void> {
  const to = options.to && options.to.startsWith("/") && !options.to.startsWith("//") ? options.to : "/auth";

  // 1. Para as requisições em voo antes que elas comecem a receber 401.
  if (qc) {
    try {
      await qc.cancelQueries();
    } catch {
      /* noop */
    }
    qc.clear();
  }

  // 2. Opcional: remove a inscrição de push deste navegador.
  if (options.unsubscribePush) {
    try {
      const { unsubscribeFromWebPush } = await import("@/lib/web-push-client");
      await unsubscribeFromWebPush();
    } catch {
      /* push é best-effort: não pode travar o logout */
    }
  }

  // 3. Invalida no servidor; se falhar (offline/token já expirado), invalida local.
  try {
    const { error } = await supabase.auth.signOut({ scope: "global" });
    if (error) await supabase.auth.signOut({ scope: "local" }).catch(() => {});
  } catch {
    try {
      await supabase.auth.signOut({ scope: "local" });
    } catch {
      /* segue para a limpeza manual */
    }
  }

  // 4. Garante que nada de sessão sobrou nesta origem.
  purgeLocalSession();

  // 5. Recarrega na tela de login (replace: não volta com o botão Voltar).
  if (typeof window !== "undefined") {
    window.location.replace(`${window.location.origin}${to}`);
  }
}
