import { createFileRoute } from "@tanstack/react-router";

// Webhook para sincronização automática vinda do Vercel
// Este endpoint deve ser chamado pelo Vercel sempre que um treino for salvo.

export const Route = createFileRoute("/api/public/vercel-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let payload: { user_id: string; event: string };
        try {
          payload = await request.json();
        } catch {
          return new Response("Invalid JSON", { status: 400 });
        }

        if (!payload.user_id) {
          return new Response("Missing user_id", { status: 400 });
        }

        console.log(`[webhook] Vercel sync triggered for user: ${payload.user_id}`);
        
        return new Response(JSON.stringify({ ok: true, message: "Sync triggered" }), {
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
