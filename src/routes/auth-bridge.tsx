import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Dumbbell, AlertTriangle } from "lucide-react";
import { safeNextPath } from "@/lib/auth-bridge";

export const Route = createFileRoute("/auth-bridge")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Finalizando login — Carga" },
      { name: "description", content: "Conclusão segura do login no Carga." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Finalizando login — Carga" },
      { property: "og:description", content: "Conclusão segura do login no Carga." },
    ],
  }),
  component: AuthBridgePage,
});

function AuthBridgePage() {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const hash = window.location.hash.startsWith("#") ? window.location.hash.slice(1) : "";
    const params = new URLSearchParams(hash);
    const access_token = params.get("access_token");
    const refresh_token = params.get("refresh_token");
    const next = safeNextPath(params.get("next")) || "/app";

    // Limpa o fragmento imediatamente para os tokens não ficarem no histórico.
    window.history.replaceState(null, "", window.location.pathname);

    if (!access_token || !refresh_token) {
      setError("Não recebemos os dados de sessão. Tente entrar novamente.");
      return;
    }

    supabase.auth
      .setSession({ access_token, refresh_token })
      .then(({ error: err }) => {
        if (err) {
          setError("Não foi possível concluir o login. Tente novamente.");
          return;
        }
        window.location.replace(next);
      })
      .catch(() => setError("Não foi possível concluir o login. Tente novamente."));
  }, []);

  return (
    <div className="grid min-h-screen place-items-center bg-background px-6">
      <div className="flex max-w-sm flex-col items-center gap-4 text-center">
        <div className="grid size-11 place-items-center rounded-xl bg-primary text-primary-foreground">
          <Dumbbell className="size-6" aria-hidden />
        </div>
        {error ? (
          <>
            <AlertTriangle className="size-5 text-destructive" aria-hidden />
            <h1 className="text-lg font-bold">Login não concluído</h1>
            <p className="text-sm text-muted-foreground">{error}</p>
            <a
              href="/auth"
              className="mt-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
            >
              Tentar de novo
            </a>
          </>
        ) : (
          <>
            <Loader2 className="size-5 animate-spin text-muted-foreground" aria-hidden />
            <h1 className="text-lg font-bold">Finalizando seu login…</h1>
            <p className="text-sm text-muted-foreground">Só um instante, estamos entrando na sua conta.</p>
          </>
        )}
      </div>
    </div>
  );
}
