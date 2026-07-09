import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dumbbell, Loader2, ShieldCheck } from "lucide-react";

// Local typed wrapper for the beta supabase.auth.oauth namespace.
type AuthorizationDetails = {
  client?: { name?: string; redirect_uri?: string } | null;
  redirect_url?: string;
  redirect_to?: string;
  scope?: string;
} | null;
type OAuthResult = { data: AuthorizationDetails; error: { message: string } | null };
const authOauth = (supabase.auth as unknown as {
  oauth: {
    getAuthorizationDetails: (id: string) => Promise<OAuthResult>;
    approveAuthorization: (id: string) => Promise<OAuthResult>;
    denyAuthorization: (id: string) => Promise<OAuthResult>;
  };
}).oauth;

export const Route = createFileRoute("/.lovable/oauth/consent")({
  // Browser-only: session lives in localStorage; SSR would always see no session.
  ssr: false,
  validateSearch: (s: Record<string, unknown>) => ({
    authorization_id: typeof s.authorization_id === "string" ? s.authorization_id : "",
  }),
  beforeLoad: async ({ search, location }) => {
    if (!search.authorization_id) throw new Error("Faltou o parâmetro authorization_id.");
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      const next = location.pathname + location.searchStr;
      throw redirect({ to: "/auth", search: { next } });
    }
  },
  loader: async ({ location }) => {
    const id = new URLSearchParams(location.search).get("authorization_id")!;
    const { data, error } = await authOauth.getAuthorizationDetails(id);
    if (error) throw new Error(error.message);
    const immediate = data?.redirect_url ?? data?.redirect_to;
    if (immediate && !data?.client) throw redirect({ href: immediate });
    return data;
  },
  component: Consent,
  errorComponent: ({ error }) => (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-3 px-6 text-center">
      <h1 className="text-xl font-bold">Não foi possível carregar a autorização</h1>
      <p className="text-sm text-muted-foreground">{String((error as Error)?.message ?? error)}</p>
    </main>
  ),
});

function Consent() {
  const details = Route.useLoaderData();
  const { authorization_id } = Route.useSearch();
  const [busy, setBusy] = useState<"approve" | "deny" | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function decide(approve: boolean) {
    setBusy(approve ? "approve" : "deny");
    setErr(null);
    const { data, error } = approve
      ? await authOauth.approveAuthorization(authorization_id)
      : await authOauth.denyAuthorization(authorization_id);
    if (error) {
      setBusy(null);
      setErr(error.message);
      return;
    }
    const target = data?.redirect_url ?? data?.redirect_to;
    if (!target) {
      setBusy(null);
      setErr("O provedor não retornou um endereço de retorno.");
      return;
    }
    window.location.href = target;
  }

  const clientName = details?.client?.name ?? "Um aplicativo externo";

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 px-6 py-10">
      <div className="flex items-center gap-2">
        <div className="grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground">
          <Dumbbell className="size-5" />
        </div>
        <span className="text-lg font-bold tracking-tight">Carga</span>
      </div>

      <div>
        <h1 className="text-2xl font-bold">Conectar {clientName} à sua conta Carga</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Isso permite que <strong>{clientName}</strong> use o Carga em seu nome — acessando os
          treinos, sessões e registros de sono que <em>você</em> tem permissão de ver.
        </p>
      </div>

      <div className="rounded-lg border border-border bg-card p-4 text-sm">
        <p className="flex items-center gap-2 font-medium">
          <ShieldCheck className="size-4 text-primary" /> O que será compartilhado
        </p>
        <ul className="mt-2 list-inside list-disc space-y-1 text-muted-foreground">
          <li>Seus treinos e exercícios cadastrados</li>
          <li>Suas sessões de treino recentes</li>
          <li>Seus registros de sono (leitura e registro)</li>
        </ul>
        <p className="mt-3 text-xs text-muted-foreground">
          As permissões e políticas de acesso do app continuam valendo. Você pode desconectar
          {" "}
          {clientName} a qualquer momento.
        </p>
      </div>

      {err && (
        <p role="alert" className="text-sm text-destructive">
          {err}
        </p>
      )}

      <div className="flex gap-3">
        <Button onClick={() => decide(true)} disabled={busy !== null} className="h-11 flex-1">
          {busy === "approve" ? <Loader2 className="size-4 animate-spin" /> : "Autorizar"}
        </Button>
        <Button
          variant="outline"
          onClick={() => decide(false)}
          disabled={busy !== null}
          className="h-11 flex-1"
        >
          {busy === "deny" ? <Loader2 className="size-4 animate-spin" /> : "Negar"}
        </Button>
      </div>
    </main>
  );
}
