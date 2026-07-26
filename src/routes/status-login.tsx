import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Loader2,
  RefreshCw,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { ALLOWED_BRIDGE_ORIGINS, CANONICAL_ORIGIN } from "@/lib/auth-bridge";
import {
  MANUAL_CHECKLIST,
  clearLoginMarker,
  originKind,
  probeBridgeEndpoint,
  readChecklist,
  readLoginMarker,
  recordLoginMarker,
  saveChecklist,
  targetOrigins,
  type LoginMarker,
} from "@/lib/login-check";

export const Route = createFileRoute("/status-login")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Status do login — Carga" },
      {
        name: "description",
        content:
          "Diagnóstico automático da sessão do Carga: confirma se o login voltou no domínio principal e no domínio espelho.",
      },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Status do login — Carga" },
      {
        property: "og:description",
        content: "Diagnóstico automático da sessão e checklist de testes de login do Carga.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: StatusLoginPage,
});

type Verdict = "ok" | "fail" | "warn" | "pending";

type CheckRow = {
  id: string;
  label: string;
  verdict: Verdict;
  detail: string;
};

function VerdictIcon({ verdict }: { verdict: Verdict }) {
  if (verdict === "pending") return <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" aria-hidden />;
  if (verdict === "ok") return <CheckCircle2 className="size-4 shrink-0 text-primary" aria-hidden />;
  if (verdict === "warn") return <AlertTriangle className="size-4 shrink-0 text-amber-500" aria-hidden />;
  return <XCircle className="size-4 shrink-0 text-destructive" aria-hidden />;
}

function verdictLabel(verdict: Verdict) {
  return verdict === "ok" ? "OK" : verdict === "fail" ? "Falhou" : verdict === "warn" ? "Atenção" : "Testando";
}

function formatWhen(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

function StatusLoginPage() {
  const [origin, setOrigin] = useState("");
  const [session, setSession] = useState<{ email: string | null; expiresAt: number | null } | null>(null);
  const [userOk, setUserOk] = useState<Verdict>("pending");
  const [marker, setMarker] = useState<LoginMarker | null>(null);
  const [probes, setProbes] = useState<Record<string, Verdict>>({});
  const [checklist, setChecklist] = useState<Record<string, boolean>>({});
  const [running, setRunning] = useState(true);

  const kind = origin ? originKind(origin) : "other";

  const run = useCallback(async () => {
    setRunning(true);
    setUserOk("pending");
    setProbes(Object.fromEntries(targetOrigins().map((o) => [o, "pending" as Verdict])));

    const { data: sessionData } = await supabase.auth.getSession();
    const current = sessionData.session;
    setSession(
      current
        ? { email: current.user?.email ?? null, expiresAt: current.expires_at ?? null }
        : null,
    );

    if (current) {
      // Revalida a sessão contra o servidor de autenticação (não confia só no storage).
      const { data: userData, error } = await supabase.auth.getUser();
      const valid = !error && !!userData?.user;
      setUserOk(valid ? "ok" : "fail");
      if (valid) {
        // Se não houver marcador desta origem, registra como login direto.
        const existing = readLoginMarker();
        if (!existing || existing.origin !== window.location.origin) recordLoginMarker("direct");
      }
    } else {
      setUserOk("fail");
    }

    setMarker(readLoginMarker());

    const results = await Promise.all(
      targetOrigins().map(async (o) => [o, (await probeBridgeEndpoint(o)) ? "ok" : "fail"] as const),
    );
    setProbes(Object.fromEntries(results));
    setRunning(false);
  }, []);

  useEffect(() => {
    setOrigin(window.location.origin);
    setChecklist(readChecklist());
    void run();
  }, [run]);

  const rows = useMemo<CheckRow[]>(() => {
    const list: CheckRow[] = [];

    list.push({
      id: "origin",
      label: "Origem atual reconhecida",
      verdict: kind === "other" ? "warn" : "ok",
      detail:
        kind === "canonical"
          ? `${origin} — domínio principal (login roda aqui).`
          : kind === "mirror"
            ? `${origin} — domínio espelho (recebe a sessão pela ponte).`
            : `${origin || "…"} — origem fora da lista (ex.: preview ou localhost). A ponte só entrega sessão para ${ALLOWED_BRIDGE_ORIGINS.join(", ")}.`,
    });

    list.push({
      id: "session",
      label: "Sessão presente neste domínio",
      verdict: session ? "ok" : "fail",
      detail: session
        ? `Sessão de ${session.email ?? "conta sem e-mail"}${
            session.expiresAt ? `, válida até ${formatWhen(new Date(session.expiresAt * 1000).toISOString())}` : ""
          }.`
        : "Nenhuma sessão salva nesta origem. Entre pelo login e volte a esta página.",
    });

    list.push({
      id: "user",
      label: "Sessão validada pelo servidor",
      verdict: userOk,
      detail:
        userOk === "ok"
          ? "O servidor de autenticação confirmou o usuário (token válido, não só cache local)."
          : userOk === "pending"
            ? "Verificando o token com o servidor…"
            : "O servidor não confirmou o usuário. Faça login novamente nesta origem.",
    });

    list.push({
      id: "via",
      label: kind === "mirror" ? "Sessão voltou pela ponte" : "Como a sessão chegou",
      verdict: marker
        ? kind === "mirror"
          ? marker.via === "bridge"
            ? "ok"
            : "warn"
          : "ok"
        : session
          ? "warn"
          : "fail",
      detail: marker
        ? `${marker.via === "bridge" ? "Recebida por /auth-bridge" : "Login direto nesta origem"} em ${formatWhen(marker.at)} (${marker.origin}).`
        : "Sem registro de entrada nesta origem. Faça um login aqui para gerar o registro.",
    });

    for (const target of targetOrigins()) {
      list.push({
        id: `probe:${target}`,
        label: `Ponte acessível em ${new URL(target).host}`,
        verdict: probes[target] ?? "pending",
        detail:
          (probes[target] ?? "pending") === "ok"
            ? `${target}/auth-bridge respondeu.`
            : (probes[target] ?? "pending") === "pending"
              ? "Testando o endereço…"
              : `${target}/auth-bridge não respondeu. Verifique se este domínio está publicado com a versão atual.`,
      });
    }

    return list;
  }, [kind, origin, session, userOk, marker, probes]);

  const failures = rows.filter((r) => r.verdict === "fail").length;
  const warnings = rows.filter((r) => r.verdict === "warn").length;
  const overall: Verdict = running ? "pending" : failures > 0 ? "fail" : warnings > 0 ? "warn" : "ok";

  const toggle = (id: string, value: boolean) => {
    const next = { ...checklist, [id]: value };
    if (!value) delete next[id];
    setChecklist(next);
    saveChecklist(next);
  };

  const done = MANUAL_CHECKLIST.filter((i) => checklist[i.id]).length;

  const otherOrigins = targetOrigins().filter((o) => o !== origin);

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
      <header className="mb-6 flex flex-col gap-3 sm:mb-8">
        <div className="flex items-center gap-2">
          <div className="grid size-10 place-items-center rounded-xl bg-primary text-primary-foreground">
            <ShieldCheck className="size-5" aria-hidden />
          </div>
          <div>
            <h1 className="text-xl font-bold leading-tight sm:text-2xl">Status do login</h1>
            <p className="text-sm text-muted-foreground">
              Diagnóstico automático da sessão nesta origem, mais o checklist de testes do fluxo completo.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={overall === "ok" ? "default" : overall === "fail" ? "destructive" : "secondary"}>
            {overall === "pending" ? "Verificando…" : overall === "ok" ? "Tudo certo" : overall === "warn" ? "Com avisos" : "Com falhas"}
          </Badge>
          <Button size="sm" variant="outline" onClick={() => void run()} disabled={running}>
            <RefreshCw className={`mr-2 size-4 ${running ? "animate-spin" : ""}`} aria-hidden />
            Rodar novamente
          </Button>
          <Button size="sm" variant="ghost" asChild>
            <Link to="/auth" search={{}}>
              Ir para o login
            </Link>
          </Button>
        </div>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Verificações automáticas</CardTitle>
          <CardDescription>
            Rodam sozinhas ao abrir a página. Abra a mesma página nos dois domínios para confirmar os dois lados.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {rows.map((row) => (
            <div key={row.id} className="flex items-start gap-3 rounded-lg border border-border/60 p-3">
              <VerdictIcon verdict={row.verdict} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-medium">{row.label}</p>
                  <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
                    {verdictLabel(row.verdict)}
                  </span>
                </div>
                <p className="mt-0.5 break-words text-xs text-muted-foreground">{row.detail}</p>
              </div>
            </div>
          ))}

          {otherOrigins.length > 0 && (
            <>
              <Separator />
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">
                  A sessão é isolada por domínio, então o outro lado precisa ser confirmado no próprio endereço:
                </p>
                <div className="flex flex-wrap gap-2">
                  {otherOrigins.map((o) => (
                    <Button key={o} size="sm" variant="outline" asChild>
                      <a href={`${o}/status-login`} target="_blank" rel="noreferrer">
                        <ExternalLink className="mr-2 size-4" aria-hidden />
                        Testar {new URL(o).host}
                      </a>
                    </Button>
                  ))}
                </div>
              </div>
            </>
          )}

          <div className="flex flex-wrap gap-2 pt-1">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                clearLoginMarker();
                setMarker(null);
              }}
            >
              Limpar registro de entrada
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base">Checklist de testes</CardTitle>
          <CardDescription>
            {done} de {MANUAL_CHECKLIST.length} concluídos — as marcações ficam salvas neste navegador.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {MANUAL_CHECKLIST.map((item) => (
            <label
              key={item.id}
              className="flex cursor-pointer items-start gap-3 rounded-lg border border-border/60 p-3 transition-colors hover:bg-muted/40"
            >
              <Checkbox
                checked={!!checklist[item.id]}
                onCheckedChange={(v) => toggle(item.id, v === true)}
                aria-label={item.label}
                className="mt-0.5"
              />
              <div className="min-w-0">
                <p className={`text-sm font-medium ${checklist[item.id] ? "text-muted-foreground line-through" : ""}`}>
                  {item.label}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">{item.hint}</p>
              </div>
            </label>
          ))}
          <p className="text-xs text-muted-foreground">
            Domínio principal: {CANONICAL_ORIGIN} · Espelho autorizado: {ALLOWED_BRIDGE_ORIGINS.join(", ")}
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
