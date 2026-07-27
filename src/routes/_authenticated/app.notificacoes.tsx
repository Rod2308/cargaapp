import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Bell, Smartphone, ChevronRight, ExternalLink, BellOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useNotificationPrefs, type NotificationPrefs } from "@/hooks/useNotificationPrefs";
import {
  subscribeToWebPush,
  unsubscribeFromWebPush,
  isPushSupported,
} from "@/lib/web-push-client";
import { needsIOSInstallForPush, isEmbedded } from "@/lib/pwa-env";

import { WorkoutReminderSettings } from "@/components/WorkoutReminderSettings";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/app/notificacoes")({
  head: () => ({
    meta: [
      { title: "Notificações — Carga" },
      { name: "description", content: "Ative ou desative categorias de notificação do Carga." },
      { property: "og:title", content: "Preferências de notificação — Carga" },
      { property: "og:description", content: "Escolha quais alertas quer receber." },
    ],
  }),
  component: NotificationPreferencesPage,
});

type Item = {
  key: keyof Omit<NotificationPrefs, "webPush">;
  label: string;
  description: string;
};

const GROUPS: { title: string; items: Item[] }[] = [
  {
    title: "Mensagens",
    items: [
      { key: "directMessages", label: "Mensagens diretas", description: "Quando alguém te envia uma mensagem." },
      { key: "groupMessages", label: "Mensagens de grupo", description: "Novas mensagens nos seus grupos." },
    ],
  },
  {
    title: "Desafios e grupos",
    items: [
      { key: "groupEvents", label: "Início e fim de desafio", description: "Avisa quando um desafio começa ou está para terminar." },
      { key: "deadline", label: "Prazo se aproximando", description: "Alerta quando faltam ≤ 3 dias." },
      { key: "rankChange", label: "Mudança de posição", description: "Aviso quando você sobe ou cai no ranking." },
      { key: "otherCheckins", label: "Check-ins de outros membros", description: "Notifica quando alguém do grupo pontua." },
    ],
  },
  {
    title: "Treino",
    items: [
      { key: "restTimer", label: "Fim do descanso entre séries", description: "Notifica quando o timer chegar ao fim." },
    ],
  },
];

function NotificationPreferencesPage() {
  const { prefs, update, permission, requestPermission } = useNotificationPrefs();
  const [busy, setBusy] = useState(false);
  const [iosInstallNeeded, setIosInstallNeeded] = useState(false);
  const [embedded, setEmbedded] = useState(false);

  useEffect(() => {
    setIosInstallNeeded(needsIOSInstallForPush());
    setEmbedded(isEmbedded());
  }, []);

  const handleWebPush = async (checked: boolean) => {
    if (iosInstallNeeded) {
      toast.error("No iPhone, adicione o Carga à Tela de Início para receber notificações.");
      return;
    }
    if (embedded && permission !== "granted") {
      toast.error("Abra o app em uma aba própria para autorizar as notificações.");
      return;
    }
    if (!isPushSupported()) {
      toast.error("Este navegador não suporta notificações push");
      return;
    }
    setBusy(true);
    try {
      if (checked) {
        let perm = permission;
        if (perm !== "granted") perm = await requestPermission();
        if (perm !== "granted") {
          toast.error(perm === "denied" ? "Permissão bloqueada nas configurações do navegador." : "Permissão negada");
          return;
        }
        await subscribeToWebPush();
        update({ webPush: true });
        toast.success("Notificações ativadas neste dispositivo");
      } else {
        await unsubscribeFromWebPush();
        update({ webPush: false });
        toast.success("Notificações desativadas neste dispositivo");
      }
    } catch (err) {
      console.error("[push] toggle error", err);
      toast.error(err instanceof Error ? err.message : "Falha ao alterar notificações");
    } finally {
      setBusy(false);
    }
  };

  const permissionLabel =
    permission === "unsupported" ? "Não suportado neste navegador."
    : embedded && permission !== "granted" ? "Bloqueado porque o app está sendo exibido dentro de outra página."
    : permission === "denied" ? "Bloqueado — ajuste nas configurações do navegador."
    : permission === "granted" ? "Permissão concedida."
    : "Precisa autorizar o navegador.";


  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <div className="mb-6 flex items-center gap-3">
        <Button asChild variant="ghost" size="icon">
          <Link to="/app/perfil"><ArrowLeft className="h-5 w-5" /></Link>
        </Button>
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Bell className="h-5 w-5" /> Notificações
          </h1>
          <p className="text-sm text-muted-foreground">Ative ou desative por categoria.</p>
        </div>
      </div>

      {iosInstallNeeded && (
        <Link
          to="/app/instalar"
          className="card-soft mb-4 flex items-center gap-3 p-5 border-amber-500/40 bg-amber-500/5 hover:bg-amber-500/10 transition"
        >
          <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-amber-500/15 text-amber-600">
            <Smartphone className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm">Instale o Carga no iPhone para receber alertas</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              No iOS, as notificações só funcionam quando o app está na Tela de Início. Ver passo a passo.
            </p>
          </div>
          <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
        </Link>
      )}

      {embedded && permission !== "granted" && !iosInstallNeeded && (
        <div className="card-soft mb-4 flex items-start gap-3 p-5 border-amber-500/40 bg-amber-500/5">
          <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-amber-500/15 text-amber-600">
            <BellOff className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm">Por que aparece “bloqueado”?</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              O app está aberto dentro de outra página (visualização embutida). Nesse modo o navegador
              recusa o pedido de permissão automaticamente. Abra o Carga em uma aba própria e ative de novo.
            </p>
            <Button
              size="sm"
              variant="outline"
              className="mt-3"
              onClick={() => window.open(`${window.location.origin}/app/notificacoes`, "_blank", "noopener")}
            >
              <ExternalLink className="h-4 w-4" /> Abrir em nova aba
            </Button>
          </div>
        </div>
      )}

      {!embedded && permission === "denied" && !iosInstallNeeded && (
        <div className="card-soft mb-4 p-5 border-amber-500/40 bg-amber-500/5">
          <p className="font-semibold text-sm">Permissão bloqueada neste navegador</p>
          <p className="text-xs text-muted-foreground mt-1">
            O bloqueio fica salvo no navegador e o app não consegue perguntar de novo. Para liberar:
          </p>
          <ol className="mt-2 list-decimal pl-5 text-xs text-muted-foreground space-y-1">
            <li>Toque no cadeado (ou no ícone ao lado do endereço do site).</li>
            <li>Abra “Configurações do site” / “Permissões”.</li>
            <li>Mude “Notificações” de Bloquear para Permitir.</li>
            <li>Recarregue esta página e ative o botão abaixo.</li>
          </ol>
        </div>
      )}

      <section className="card-soft p-5 mb-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <Label htmlFor="pref-web" className="text-base">Notificações do navegador</Label>
            <p className="text-xs text-muted-foreground mt-1">
              {iosInstallNeeded
                ? "Adicione o Carga à Tela de Início para habilitar."
                : permissionLabel}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Ative para receber alertas mesmo com o app fechado.
            </p>
            {iosInstallNeeded && (
              <Button asChild size="sm" variant="outline" className="mt-3">
                <Link to="/app/instalar">Como instalar</Link>
              </Button>
            )}
          </div>
          <Switch
            id="pref-web"
            checked={prefs.webPush && permission === "granted"}
            disabled={busy || permission === "unsupported" || iosInstallNeeded || (embedded && permission !== "granted")}
            onCheckedChange={handleWebPush}
          />
        </div>
      </section>


      <WorkoutReminderSettings />

      {GROUPS.map((group) => (
        <section key={group.title} className="card-soft p-5 mb-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-4">
            {group.title}
          </h2>
          <div className="space-y-4">
            {group.items.map((item) => (
              <div key={item.key} className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <Label htmlFor={`pref-${item.key}`} className="text-base">{item.label}</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>
                </div>
                <Switch
                  id={`pref-${item.key}`}
                  checked={prefs[item.key]}
                  onCheckedChange={(v) => update({ [item.key]: v } as Partial<NotificationPrefs>)}
                />
              </div>
            ))}
          </div>
        </section>
      ))}

      <p className="text-xs text-muted-foreground px-1">
        As preferências ficam salvas neste dispositivo. Mensagens e eventos podem chegar por push do navegador se você tiver ativado acima.
      </p>
    </div>
  );
}
