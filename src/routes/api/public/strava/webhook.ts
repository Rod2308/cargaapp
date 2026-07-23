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
        // Always respond 200 quickly; Strava retries on non-2xx.
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

        try {
          const { findUserIdByAthleteId, upsertActivityForUser, deleteActivityForUser } = await import(
            "@/lib/strava.server"
          );
          const userId = await findUserIdByAthleteId(payload.owner_id);
          if (!userId) return new Response("no user", { status: 200 });

          if (payload.aspect_type === "delete") {
            await deleteActivityForUser(userId, payload.object_id);
          } else {
            // create or update -> upsert
            await upsertActivityForUser(userId, payload.object_id);
          }
        } catch (e) {
          console.error("[strava/webhook]", e);
        }
        return new Response("ok", { status: 200 });
      },
    },
  },
});
