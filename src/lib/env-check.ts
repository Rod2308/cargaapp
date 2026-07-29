/**
 * Conferência das variáveis de ambiente públicas (VITE_*).
 *
 * O domínio espelho (Vercel) precisa ter exatamente os mesmos valores do
 * domínio principal (Lovable). Estes valores são publicáveis por definição
 * (URL do backend e chave publishable), por isso podem ficar no código como
 * referência de comparação.
 */

export const EXPECTED_PUBLIC_ENV = {
  VITE_SUPABASE_URL: "https://lgxwvmhaaxiymhjqmglk.supabase.co",
  VITE_SUPABASE_PROJECT_ID: "lgxwvmhaaxiymhjqmglk",
  VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_Wn25jk_uxUmXuuBNBSS7LA_TPuCdCCU",
} as const;

export type PublicEnvName = keyof typeof EXPECTED_PUBLIC_ENV;

export type EnvCheck = {
  name: PublicEnvName;
  status: "ok" | "missing" | "different";
  /** Valor atual mascarado — nunca exibimos a chave inteira na tela. */
  masked: string;
};

function mask(value: string | undefined): string {
  if (!value) return "—";
  if (value.length <= 12) return value;
  return `${value.slice(0, 8)}…${value.slice(-4)}`;
}

function readEnv(name: PublicEnvName): string | undefined {
  const env = import.meta.env as unknown as Record<string, string | undefined>;
  const raw = env[name];
  return typeof raw === "string" && raw.length > 0 ? raw : undefined;
}

export function checkPublicEnv(): EnvCheck[] {
  return (Object.keys(EXPECTED_PUBLIC_ENV) as PublicEnvName[]).map((name) => {
    const current = readEnv(name);
    const expected = EXPECTED_PUBLIC_ENV[name];
    const status: EnvCheck["status"] = !current ? "missing" : current === expected ? "ok" : "different";
    return { name, status, masked: mask(current) };
  });
}

export function publicEnvIsSynced(checks = checkPublicEnv()): boolean {
  return checks.every((c) => c.status === "ok");
}
