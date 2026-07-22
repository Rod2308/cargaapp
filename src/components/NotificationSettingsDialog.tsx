import { Bell } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useNotificationPrefs } from "@/hooks/useNotificationPrefs";
import { subscribeToWebPush, unsubscribeFromWebPush, isPushSupported } from "@/lib/web-push-client";
import { toast } from "sonner";

export function NotificationSettingsDialog() {
  const { prefs, update, permission, requestPermission } = useNotificationPrefs();
  const [busy, setBusy] = useState(false);

  const enablePush = async () => {
    if (!isPushSupported()) {
      toast.error("Este navegador não suporta notificações push");
      return;
    }
    setBusy(true);
    try {
      let perm = permission;
      if (perm !== "granted") perm = await requestPermission();
      if (perm !== "granted") {
        toast.error(perm === "denied" ? "Permissão bloqueada nas configurações do navegador." : "Permissão negada");
        return;
      }
      await subscribeToWebPush();
      update({ webPush: true });
      toast.success("Notificações ativadas neste dispositivo");
    } catch (err) {
      console.error("[push] subscribe error", err);
      toast.error(err instanceof Error ? err.message : "Falha ao ativar notificações");
    } finally {
      setBusy(false);
    }
  };

  const disablePush = async () => {
    setBusy(true);
    try {
      await unsubscribeFromWebPush();
      update({ webPush: false });
      toast.success("Notificações desativadas neste dispositivo");
    } catch (err) {
      console.error("[push] unsubscribe error", err);
      toast.error("Não foi possível desativar completamente. Tente de novo.");
    } finally {
      setBusy(false);
    }
  };

  const handleWebPush = async (checked: boolean) => {
    if (checked) await enablePush();
    else await disablePush();
  };


  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Bell className="h-4 w-4 mr-2" />
          Notificações
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Preferências de notificação</DialogTitle>
          <DialogDescription>
            Escolha o que deseja receber sobre este grupo.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="flex items-center justify-between gap-4">
            <div>
              <Label htmlFor="pref-rank">Mudança de posição no ranking</Label>
              <p className="text-xs text-muted-foreground">Aviso quando você sobe ou cai.</p>
            </div>
            <Switch id="pref-rank" checked={prefs.rankChange}
              onCheckedChange={(v) => update({ rankChange: v })} />
          </div>

          <div className="flex items-center justify-between gap-4">
            <div>
              <Label htmlFor="pref-deadline">Prazo se aproximando</Label>
              <p className="text-xs text-muted-foreground">Alerta quando faltam ≤ 3 dias.</p>
            </div>
            <Switch id="pref-deadline" checked={prefs.deadline}
              onCheckedChange={(v) => update({ deadline: v })} />
          </div>

          <div className="flex items-center justify-between gap-4">
            <div>
              <Label htmlFor="pref-checkins">Check-ins de outros membros</Label>
              <p className="text-xs text-muted-foreground">Notifica quando alguém pontua.</p>
            </div>
            <Switch id="pref-checkins" checked={prefs.otherCheckins}
              onCheckedChange={(v) => update({ otherCheckins: v })} />
          </div>

          <div className="border-t pt-4 flex items-center justify-between gap-4">
            <div>
              <Label htmlFor="pref-web">Notificações do navegador</Label>
              <p className="text-xs text-muted-foreground">
                {permission === "unsupported" && "Não suportado neste navegador."}
                {permission === "denied" && "Bloqueado — ajuste nas configurações do navegador."}
                {permission === "granted" && "Permissão concedida."}
                {permission === "default" && "Precisa autorizar o navegador."}
              </p>
            </div>
            <Switch
              id="pref-web"
              checked={prefs.webPush && permission === "granted"}
              disabled={permission === "unsupported" || permission === "denied"}
              onCheckedChange={handleWebPush}
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
