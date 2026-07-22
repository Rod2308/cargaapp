import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  Share,
  Plus,
  CheckCircle2,
  Bell,
  Download,
  MoreVertical,
  Smartphone,
  Apple,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { isAndroid, isIOS, isStandalonePWA } from "@/lib/pwa-env";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export const Route = createFileRoute("/_authenticated/app/instalar")({
  head: () => ({
    meta: [
      { title: "Instalar o Carga na Tela de Início" },
      {
        name: "description",
        content:
          "Passo a passo para adicionar o Carga à Tela de Início do iPhone e habilitar notificações no iOS via PWA.",
      },
      { property: "og:title", content: "Adicionar Carga à Tela de Início" },
      {
        property: "og:description",
        content:
          "Instale o Carga como app no iPhone ou Android para receber notificações mesmo com o app fechado.",
      },
    ],
  }),
  component: InstallPage,
});

function InstallPage() {
  const router = useRouter();
  const [installed, setInstalled] = useState<boolean>(false);
  const [ios, setIos] = useState(false);
  const [android, setAndroid] = useState(false);
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    setInstalled(isStandalonePWA());
    setIos(isIOS());
    setAndroid(isAndroid());

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferred(null);
    };
    window.addEventListener("beforeinstallprompt", onPrompt as EventListener);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt as EventListener);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const install = async () => {
    if (!deferred) return;
    await deferred.prompt();
    const choice = await deferred.userChoice;
    if (choice.outcome === "accepted") setDeferred(null);
  };

  // Show iOS as the primary path when we can't tell (safer for iPhone users).
  const showIOS = ios || (!android && !deferred);
  const showAndroid = android || !!deferred;

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <div className="mb-6 flex items-center gap-3">
        <Button asChild variant="ghost" size="icon">
          <Link to="/app/notificacoes">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Smartphone className="h-5 w-5" /> Instalar o Carga
          </h1>
          <p className="text-sm text-muted-foreground">
            Adicione à Tela de Início para receber notificações mesmo com o app fechado.
          </p>
        </div>
      </div>

      {installed ? (
        <section className="card-soft p-5 mb-4 border-green-500/40 bg-green-500/5">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="h-6 w-6 text-green-500 shrink-0" />
            <div className="flex-1">
              <p className="font-semibold">Carga já está instalado neste dispositivo</p>
              <p className="text-sm text-muted-foreground mt-1">
                Agora você pode ativar as notificações do navegador.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button asChild size="sm">
                  <Link to="/app/notificacoes">
                    <Bell className="h-4 w-4 mr-1" /> Ativar notificações
                  </Link>
                </Button>
                <Button variant="ghost" size="sm" onClick={() => router.navigate({ to: "/app" })}>
                  Ir para o app
                </Button>
              </div>
            </div>
          </div>
        </section>
      ) : (
        <section className="card-soft p-5 mb-4 border-amber-500/40 bg-amber-500/5">
          <p className="text-sm">
            <b>Por que instalar?</b> No iPhone (iOS), o Safari só entrega notificações push quando o
            site está adicionado à Tela de Início como app. Sem isso, os alertas não chegam com o
            app fechado.
          </p>
        </section>
      )}

      {showIOS && (
        <section className="card-soft p-5 mb-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-4 flex items-center gap-2">
            <Apple className="h-4 w-4" /> No iPhone / iPad (Safari)
          </h2>
          <ol className="space-y-4 text-sm">
            <Step n={1}>
              Abra o Carga no <b>Safari</b> (não funciona no Chrome/Firefox no iOS).
            </Step>
            <Step n={2}>
              Toque no botão <b>Compartilhar</b>{" "}
              <Share className="mx-1 inline h-4 w-4 align-[-3px]" /> na barra inferior.
            </Step>
            <Step n={3}>
              Role a lista e toque em <b>Adicionar à Tela de Início</b>{" "}
              <Plus className="mx-1 inline h-4 w-4 align-[-3px]" />.
            </Step>
            <Step n={4}>
              Confirme em <b>Adicionar</b>. O ícone do Carga aparece na sua tela inicial.
            </Step>
            <Step n={5}>
              Abra o Carga pelo <b>novo ícone</b> e vá em{" "}
              <Link to="/app/notificacoes" className="underline underline-offset-2">
                Notificações
              </Link>{" "}
              para autorizar os alertas.
            </Step>
          </ol>
          <p className="mt-4 text-xs text-muted-foreground">
            Requer iOS 16.4 ou superior para receber notificações push.
          </p>
        </section>
      )}

      {showAndroid && (
        <section className="card-soft p-5 mb-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-4 flex items-center gap-2">
            <Smartphone className="h-4 w-4" /> No Android (Chrome)
          </h2>
          {deferred ? (
            <div className="space-y-3">
              <p className="text-sm">Seu navegador pode instalar o Carga com um toque:</p>
              <Button onClick={install}>
                <Download className="h-4 w-4 mr-1" /> Instalar agora
              </Button>
            </div>
          ) : (
            <ol className="space-y-4 text-sm">
              <Step n={1}>
                Abra o menu do Chrome <MoreVertical className="mx-1 inline h-4 w-4 align-[-3px]" />{" "}
                no canto superior direito.
              </Step>
              <Step n={2}>
                Toque em <b>Instalar app</b> ou <b>Adicionar à tela inicial</b>.
              </Step>
              <Step n={3}>Confirme para adicionar o ícone à tela inicial.</Step>
              <Step n={4}>
                Abra o Carga pelo ícone e ative as{" "}
                <Link to="/app/notificacoes" className="underline underline-offset-2">
                  notificações
                </Link>
                .
              </Step>
            </ol>
          )}
        </section>
      )}

      <p className="text-xs text-muted-foreground px-1">
        Já instalado? Abra o Carga pelo ícone da tela inicial e volte para{" "}
        <Link to="/app/notificacoes" className="underline">
          Notificações
        </Link>
        .
      </p>
    </div>
  );
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="grid size-6 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground text-xs font-semibold">
        {n}
      </span>
      <span className="pt-0.5">{children}</span>
    </li>
  );
}
