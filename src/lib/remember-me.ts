// Controla a persistência da sessão Supabase entre "Lembrar-me" ligado/desligado.
//
// Estratégia:
// - Supabase salva a sessão em localStorage (chave `sb-<ref>-auth-token`).
// - Quando "Lembrar-me" está DESLIGADO, movemos essa chave para sessionStorage
//   e marcamos `carga_temp_session=1` também em sessionStorage.
// - sessionStorage sobrevive a reloads da MESMA aba, mas é apagado quando a aba/janela
//   é fechada. Assim, o usuário continua logado se recarregar, e é deslogado ao fechar.
// - Antes do Supabase client inicializar (import a partir de router.tsx), esta rotina
//   copia a chave de sessionStorage de volta para localStorage para o client ler.
// - Em `beforeunload`, se a sessão é temporária, removemos novamente do localStorage
//   para garantir que ela morra junto com a aba.

const SUPABASE_REF = "lgxwvmhaaxiymhjqmglk";
const AUTH_KEY = `sb-${SUPABASE_REF}-auth-token`;
const TEMP_FLAG = "carga_temp_session";
const REMEMBER_FLAG = "carga_remember_me"; // localStorage: última escolha do usuário (para UI)

function isBrowser() {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

/** Retorna a última preferência salva pelo usuário (default: true). */
export function getRememberMePreference(): boolean {
  if (!isBrowser()) return true;
  const v = localStorage.getItem(REMEMBER_FLAG);
  return v === null ? true : v === "1";
}

/**
 * Aplica a preferência de "Lembrar-me" logo APÓS um sign-in bem sucedido,
 * quando o token já foi gravado em localStorage pelo Supabase.
 */
export function applyRememberMe(remember: boolean) {
  if (!isBrowser()) return;
  localStorage.setItem(REMEMBER_FLAG, remember ? "1" : "0");
  if (remember) {
    // Sessão permanente: limpa qualquer marca temporária.
    sessionStorage.removeItem(TEMP_FLAG);
    sessionStorage.removeItem(AUTH_KEY);
    return;
  }
  // Sessão temporária: move o token para sessionStorage.
  const token = localStorage.getItem(AUTH_KEY);
  if (token) {
    sessionStorage.setItem(AUTH_KEY, token);
    localStorage.removeItem(AUTH_KEY);
  }
  sessionStorage.setItem(TEMP_FLAG, "1");
}

/**
 * Roda no boot do client, ANTES do Supabase client inicializar.
 * - Se existir uma sessão temporária em sessionStorage, hidrata o localStorage
 *   para o Supabase client conseguir carregá-la.
 * - Registra o handler de beforeunload que remove o token do localStorage
 *   se a sessão for temporária (não deve sobreviver ao fechamento da aba).
 */
export function initRememberMe() {
  if (!isBrowser()) return;
  try {
    const temp = sessionStorage.getItem(TEMP_FLAG) === "1";
    if (temp) {
      const stored = sessionStorage.getItem(AUTH_KEY);
      if (stored && !localStorage.getItem(AUTH_KEY)) {
        localStorage.setItem(AUTH_KEY, stored);
      }
    }
    const cleanup = () => {
      if (sessionStorage.getItem(TEMP_FLAG) === "1") {
        // Mantém em sessionStorage (sobrevive a reload); apaga do localStorage.
        const cur = localStorage.getItem(AUTH_KEY);
        if (cur) sessionStorage.setItem(AUTH_KEY, cur);
        localStorage.removeItem(AUTH_KEY);
      }
    };
    window.addEventListener("beforeunload", cleanup);
    window.addEventListener("pagehide", cleanup);
  } catch {
    // storage indisponível (modo privado, iframe restrito) — ignora
  }
}
