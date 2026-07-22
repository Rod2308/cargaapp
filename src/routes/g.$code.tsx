import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Trophy, Users } from "lucide-react";
import { getPublicInvite, type PublicInvite } from "@/lib/invites.functions";

const SITE_URL = "https://cargaapp.lovable.app";
const DEFAULT_OG_IMAGE =
  "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/00425b45-eeac-49c1-8a72-fbb87d9cff32/id-preview-84b6e1cb--a45a51fe-d372-477e-98b1-329caa5ebd07.lovable.app-1783396862047.png";

function sanitize(code: string) {
  const up = code.toUpperCase().replace(/[^A-Z0-9-]/g, "");
  return up.slice(0, 12);
}

async function fetchPublicInvite(code: string): Promise<PublicInvite> {
  if (!code || code.length < 4) return null;
  try {
    return await getPublicInvite({ data: { code } });
  } catch {
    return null;
  }
}

function truncate(s: string, n = 160) {
  const t = s.replace(/\s+/g, " ").trim();
  return t.length > n ? `${t.slice(0, n - 1)}…` : t;
}

export const Route = createFileRoute("/g/$code")({
  parseParams: (p) => ({ code: sanitize(String(p.code ?? "")) }),
  stringifyParams: (p) => ({ code: p.code }),
  loader: async ({ params }) => {
    const invite = await fetchPublicInvite(params.code);
    return { invite };
  },
  head: ({ params, loaderData }) => {
    const invite = loaderData?.invite ?? null;
    const url = `${SITE_URL}/g/${params.code}`;
    const emoji = invite?.emoji ?? "🏆";
    const title = invite
      ? `${emoji} ${invite.name} — Convite no Carga`
      : `Convite para grupo · Carga`;
    const membersTxt = invite
      ? `${invite.member_count} ${invite.member_count === 1 ? "membro" : "membros"}`
      : "";
    const description = invite
      ? truncate(
          invite.description
            ? `${invite.description} · ${membersTxt} · Código ${params.code}`
            : `Entre no grupo "${invite.name}" no Carga (${membersTxt}). Código ${params.code}.`,
        )
      : `Você foi convidado para um grupo no Carga. Código: ${params.code}. Toque para entrar.`;
    const ogImage = DEFAULT_OG_IMAGE;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { name: "robots", content: invite?.is_archived ? "noindex" : "noindex, nofollow" },

        // Open Graph
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { property: "og:url", content: url },
        { property: "og:site_name", content: "Carga" },
        { property: "og:locale", content: "pt_BR" },
        { property: "og:image", content: ogImage },
        { property: "og:image:secure_url", content: ogImage },
        { property: "og:image:type", content: "image/png" },
        { property: "og:image:width", content: "1200" },
        { property: "og:image:height", content: "630" },
        { property: "og:image:alt", content: invite ? `Grupo ${invite.name} no Carga` : "Carga" },

        // Twitter / X — summary_large_image for a big preview card
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: title },
        { name: "twitter:description", content: description },
        { name: "twitter:image", content: ogImage },
        { name: "twitter:image:alt", content: invite ? `Grupo ${invite.name} no Carga` : "Carga" },

        // WhatsApp uses OG; these help iMessage / Telegram too
        { name: "theme-color", content: "#111111" },
      ],
      links: [{ rel: "canonical", href: url }],
    };
  },
  component: InviteLanding,
});

function InviteLanding() {
  const { code } = Route.useParams();
  const { invite } = Route.useLoaderData();
  const [status, setStatus] = useState<"checking" | "redirecting" | "invalid">(
    invite === null ? "checking" : "checking",
  );

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
        <div className="mx-auto mb-2 text-4xl leading-none">{invite?.emoji ?? "🏆"}</div>
        {invite ? (
          <>
            <p className="text-lg font-semibold">{invite.name}</p>
            {invite.description && (
              <p className="mt-1 line-clamp-3 text-sm text-muted-foreground">{invite.description}</p>
            )}
            <p className="mt-2 inline-flex items-center gap-1 text-xs text-muted-foreground">
              <Users className="size-3.5" /> {invite.member_count}{" "}
              {invite.member_count === 1 ? "membro" : "membros"}
            </p>
          </>
        ) : (
          <>
            <Trophy className="mx-auto mb-2 size-8 text-amber-500" />
            <p className="text-lg font-semibold">Convite para grupo</p>
          </>
        )}
        <p className="mt-2 font-mono text-sm text-muted-foreground">{code}</p>
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
