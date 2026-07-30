// Autenticação simples para endpoints chamados pelo agendador (pg_cron).
// O agendador envia o header `apikey` com a chave publicável do backend.
export function isAuthorizedCronRequest(request: Request): boolean {
  // No Lovable a variável vem sem prefixo; em outros hosts (Vercel) muitas
  // vezes só a versão VITE_ é configurada. Aceitamos as duas.
  const expected =
    process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!expected) return false;

  const apikey = request.headers.get("apikey");
  const auth = request.headers.get("authorization");
  const bearer = auth?.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : null;

  return apikey === expected || bearer === expected;
}

export function cronUnauthorized(): Response {
  return new Response(JSON.stringify({ error: "unauthorized" }), {
    status: 401,
    headers: { "Content-Type": "application/json" },
  });
}
