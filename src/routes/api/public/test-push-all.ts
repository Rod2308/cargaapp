import { createAPIFileRoute } from "@tanstack/start/api";

export const APIRoute = createAPIFileRoute("/api/public/test-push-all")({
  GET: async ({ request }) => {
    const subject = process.env.VAPID_SUBJECT;
    const publicKey = process.env.VAPID_PUBLIC_KEY;
    const privateKey = process.env.VAPID_PRIVATE_KEY;
    
    if (!subject || !publicKey || !privateKey) {
      return new Response(JSON.stringify({ error: "VAPID keys missing" }), { status: 500 });
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: subs, error } = await supabaseAdmin
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth, user_agent, user_id");
      
    if (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }
    
    if (!subs || subs.length === 0) {
      return new Response(JSON.stringify({ message: "No subscriptions found" }), { status: 200 });
    }

    const webpush = (await import("web-push")).default;
    webpush.setVapidDetails(subject, publicKey, privateKey);

    const payload = JSON.stringify({
      title: "🚀 Teste Global da Vercel",
      body: "Se você recebeu isso, as notificações em produção estão 100% ativas!",
      tag: "test-global",
      data: { url: "/app/notificacoes" },
    });

    let sent = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const s of subs) {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          payload,
          { TTL: 120, urgency: "high" },
        );
        sent++;
      } catch (err: any) {
        failed++;
        errors.push(`Failed for ${s.user_id}: ${err?.statusCode || err?.message}`);
      }
    }

    return new Response(JSON.stringify({ 
      success: true, 
      total: subs.length, 
      sent, 
      failed, 
      errors 
    }), {
      headers: { "Content-Type": "application/json" }
    });
  },
});
