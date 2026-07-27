import { createFileRoute } from "@tanstack/react-router";

// Devolve a chave pública VAPID. É pública por definição (vai no bundle do
// navegador de qualquer forma). Exposta como rota pública com CORS para que a
// cópia estática do app (domínio espelho, sem servidor) também consiga se
// inscrever em Web Push usando exatamente a mesma chave.
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "content-type",
  "Cache-Control": "public, max-age=300",
};

export const Route = createFileRoute("/api/public/vapid")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      GET: async () => {
        const publicKey = process.env.VAPID_PUBLIC_KEY;
        if (!publicKey) {
          return new Response(JSON.stringify({ error: "not_configured" }), {
            status: 503,
            headers: { ...CORS, "content-type": "application/json" },
          });
        }
        return new Response(JSON.stringify({ publicKey }), {
          status: 200,
          headers: { ...CORS, "content-type": "application/json" },
        });
      },
    },
  },
});
