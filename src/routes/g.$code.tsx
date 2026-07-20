import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Trophy } from "lucide-react";

function sanitize(code: string) {
  const up = code.toUpperCase().replace(/[^A-Z0-9-]/g, "");
  return up.slice(0, 12);
}

export const Route = createFileRoute("/g/$code")({
  parseParams: (p) => ({ code: sanitize(String(p.code ?? "")) }),
  stringifyParams: (p) => ({ code: p.code }),
  head: ({ params }) => ({
    meta: [
      { title: `Convite para grupo · Carga` },
      {
        name: "description",
        content: `Você foi convidado para um grupo no Carga. Código: ${params.code}. Toque para entrar.`,
      },
      { property: "og:title", content: "Convite para grupo no Carga" },
      {
        property: "og:description",
        content: `Entre no meu grupo de treino no Carga (código ${params.code}).`,
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: InviteLanding,
});

function InviteLanding() {
  const { code } = Route.useParams();
  const [status, setStatus] = useState<"checking" | "redirecting" | "invalid">("checking");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!code || code.length < 4) {
        setStatus("invalid");
        return;
      }
      const { data } = await supabase.auth.getUser();
      if (cancelled) return;
      const dest = `/app/grupos?codigo=${encodeURIComponent(code)}&ref=link`;
      setStatus("redirecting");
      if (data.user) {
        window.location.replace(dest);
      } else {
        window.location.replace(`/auth?next=${encodeURIComponent(dest)}`);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [code]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <div className="max-w-sm rounded-xl border border-border bg-card p-6 text-center">
        <Trophy className="mx-auto mb-2 size-8 text-amber-500" />
        <p className="text-lg font-semibold">Convite para grupo</p>
        <p className="mt-1 font-mono text-sm text-muted-foreground">{code}</p>
        <div className="mt-4 flex items-center justify-center gap-2 text-sm text-muted-foreground">
          {status === "invalid" ? (
            <span>Link inválido.</span>
          ) : (
            <>
              <Loader2 className="size-4 animate-spin" />
              <span>Abrindo o app…</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
