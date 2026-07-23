import { createFileRoute } from "@tanstack/react-router";

// Strava webhook: GET for subscription validation, POST for events.
// Docs: https://developers.strava.com/docs/webhooks/

export const Route = createFileRoute("/api/public/strava/webhook")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const mode = url.searchParams.get("hub.mode");
        const token = url.searchParams.get("hub.verify_token");
        const challenge = url.searchParams.get("hub.challenge");
        const expected = process.env.STRAVA_WEBHOOK_VERIFY_TOKEN;
        if (mode === "subscribe" && expected && token === expected && challenge) {
          return Response.json({ "hub.challenge": challenge });
        }
        return new Response("forbidden", { status: 403 });
      },
      POST: async ({ request }) => {
        // Strava exige resposta em < 2s. Lemos o payload e processamos
        // em background com waitUntil para não estourar o timeout.
        let payload: {
          object_type?: string;
          object_id?: number;
          aspect_type?: string;
          owner_id?: number;
          updates?: Record<string, unknown>;
        };
        try {
          payload = await request.json();
        } catch {
          return new Response("bad json", { status: 200 });
        }

        if (payload.object_type !== "activity" || !payload.object_id || !payload.owner_id) {
          return new Response("ignored", { status: 200 });
        }

        const objectId = payload.object_id;
        const ownerId = payload.owner_id;
        const aspect = payload.aspect_type;

        const work = (async () => {
          try {
            const { findUserIdByAthleteId, upsertActivityForUser, deleteActivityForUser } = await import(
              "@/lib/strava.server"
            );
            const userId = await findUserIdByAthleteId(ownerId);
            if (!userId) return;
            if (aspect === "delete") {
              await deleteActivityForUser(userId, objectId);
            } else {
              await upsertActivityForUser(userId, objectId);
            }
          } catch (e) {
            console.error("[strava/webhook]", e);
          }
        })();

        // Tenta usar ctx.waitUntil (Cloudflare Workers) para manter o handler
        // vivo depois do 200. Se não estiver disponível, o promise ainda roda.
        try {
          const ctx = (globalThis as { __CF_CONTEXT__?: { waitUntil?: (p: Promise<unknown>) => void } }).__CF_CONTEXT__;
          ctx?.waitUntil?.(work);
        } catch {
          // ignore
        }

        return new Response("ok", { status: 200 });
      },
    },
  },
});
