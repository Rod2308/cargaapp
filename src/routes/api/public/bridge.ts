import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { ALLOWED_BRIDGE_ORIGINS, CANONICAL_ORIGIN } from "@/lib/auth-bridge";

// Ponte HTTP de funções do servidor.
//
// O domínio espelho (Vercel) é servido como site estático e não executa server
// functions. Esta rota expõe exatamente as mesmas ações — o mesmo código de
// bridge-actions.server.ts — por HTTP, autenticado com o token do próprio
// usuário. Só origens espelho autorizadas podem chamá-la (CORS fechado).

const ALLOWED_ORIGINS = [CANONICAL_ORIGIN, ...ALLOWED_BRIDGE_ORIGINS] as string[];

function corsHeaders(origin: string | null) {
  const allowed = origin && ALLOWED_ORIGINS.includes(origin) ? origin : "";
  return {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Headers": "authorization, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  } as Record<string, string>;
}

function isNewApiKey(value: string) {
  return value.startsWith("sb_publishable_") || value.startsWith("sb_secret_");
}

export const Route = createFileRoute("/api/public/bridge")({
  server: {
    handlers: {
      OPTIONS: async ({ request }) =>
        new Response(null, { status: 204, headers: corsHeaders(request.headers.get("origin")) }),

      POST: async ({ request }) => {
        const origin = request.headers.get("origin");
        const headers = corsHeaders(origin);

        if (origin && !ALLOWED_ORIGINS.includes(origin)) {
          return new Response(JSON.stringify({ error: "Origem não autorizada" }), {
            status: 403,
            headers,
          });
        }

        let body: { action?: string; payload?: unknown };
        try {
          body = (await request.json()) as { action?: string; payload?: unknown };
        } catch {
          return new Response(JSON.stringify({ error: "Corpo inválido" }), { status: 400, headers });
        }

        const action = typeof body.action === "string" ? body.action : "";
        const { AUTHED_ACTIONS, PUBLIC_ACTIONS } = await import("@/lib/bridge-actions.server");

        try {
          const publicAction = PUBLIC_ACTIONS[action];
          if (publicAction) {
            const result = await publicAction(body.payload);
            return new Response(JSON.stringify({ result }), { headers });
          }

          const authedAction = AUTHED_ACTIONS[action];
          if (!authedAction) {
            return new Response(JSON.stringify({ error: "Ação desconhecida" }), {
              status: 404,
              headers,
            });
          }

          const authHeader = request.headers.get("authorization") ?? "";
          const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
          if (!token || token.split(".").length !== 3) {
            return new Response(JSON.stringify({ error: "Não autenticado" }), {
              status: 401,
              headers,
            });
          }

          const SUPABASE_URL = process.env.SUPABASE_URL;
          const SUPABASE_PUBLISHABLE_KEY =
            process.env.SUPABASE_PUBLISHABLE_KEY ||
            process.env.SUPABASE_ANON_KEY ||
            process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
          if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
            return new Response(JSON.stringify({ error: "Backend não configurado" }), {
              status: 500,
              headers,
            });
          }

          const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
            auth: { persistSession: false, autoRefreshToken: false },
            global: {
              headers: { Authorization: `Bearer ${token}` },
              fetch: (input, init) => {
                const h = new Headers(init?.headers);
                if (
                  isNewApiKey(SUPABASE_PUBLISHABLE_KEY) &&
                  h.get("Authorization") === `Bearer ${SUPABASE_PUBLISHABLE_KEY}`
                ) {
                  h.delete("Authorization");
                }
                h.set("apikey", SUPABASE_PUBLISHABLE_KEY);
                return fetch(input, { ...init, headers: h });
              },
            },
          });

          // Tenta getClaims (rápido, decode local + verificação).
          // Se falhar, usa getUser() que valida direto na API do Supabase Auth.
          let userId: string | undefined;
          const { data: claims, error: claimsError } = await supabase.auth.getClaims(token);
          if (!claimsError && claims?.claims?.sub) {
            userId = claims.claims.sub;
          } else {
            const { data: userData, error: userError } = await supabase.auth.getUser(token);
            if (userError || !userData?.user?.id) {
              return new Response(JSON.stringify({ error: "Sessão inválida" }), {
                status: 401,
                headers,
              });
            }
            userId = userData.user.id;
          }

          const result = await authedAction(supabase, userId, body.payload);
          return new Response(JSON.stringify({ result }), { headers });
        } catch (err) {
          const message = err instanceof Error ? err.message : "Falha inesperada";
          return new Response(JSON.stringify({ error: message }), { status: 400, headers });
        }
      },
    },
  },
});
