import { bridged } from "@/lib/server-bridge";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  getReminderSettings,
  saveReminderSettings,
  DEFAULT_REMINDER_SETTINGS,
  type ReminderSettings,
} from "@/lib/reminder-settings.functions";
import {
  loadReminderSettingsClient,
  saveReminderSettingsClient,
} from "@/lib/reminder-settings-client";

const DAYS = [
  { value: 1, label: "Seg" },
  { value: 2, label: "Ter" },
  { value: 3, label: "Qua" },
  { value: 4, label: "Qui" },
  { value: 5, label: "Sex" },
  { value: 6, label: "Sáb" },
  { value: 0, label: "Dom" },
];

export function WorkoutReminderSettings() {
  const fetchSettings = bridged("reminders.get", getReminderSettings);
  const save = bridged("reminders.save", saveReminderSettings);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["reminder-settings"],
    queryFn: async () => {
      try {
        return await fetchSettings();
      } catch (err) {
        // Domínio espelho (site estático): sem server functions, lê direto do backend.
        console.warn("[lembretes] usando fallback do cliente", err);
        return await loadReminderSettingsClient();
      }
    },
  });

  const [local, setLocal] = useState<ReminderSettings>(DEFAULT_REMINDER_SETTINGS);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (data) setLocal(data);
  }, [data]);

  const mutation = useMutation({
    mutationFn: async (next: ReminderSettings) => {
      try {
        return await save({ data: next });
      } catch (err) {
        console.warn("[lembretes] usando fallback do cliente ao salvar", err);
        return await saveReminderSettingsClient(next);
      }
    },
    onSuccess: () => {
      setDirty(false);
      queryClient.invalidateQueries({ queryKey: ["reminder-settings"] });
      toast.success("Lembretes atualizados");
    },
    onError: (err: unknown) =>
      toast.error(err instanceof Error ? err.message : "Não foi possível salvar"),
  });

  const patch = (p: Partial<ReminderSettings>) => {
    setLocal((prev) => ({ ...prev, ...p }));
    setDirty(true);
  };

  const toggleDay = (day: number) => {
    const rest = local.restDays.includes(day)
      ? local.restDays.filter((d) => d !== day)
      : [...local.restDays, day];
    patch({ restDays: rest.sort() });
  };

  const commit = () => {
    const tz =
      Intl.DateTimeFormat().resolvedOptions().timeZone || DEFAULT_REMINDER_SETTINGS.timezone;
    mutation.mutate({ ...local, timezone: tz });
  };

  return (
    <section className="card-soft p-5 mb-4">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-4">
        Lembretes de treino
      </h2>

      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <Label htmlFor="reminder-enabled" className="text-base">
            Ativar lembretes de treino diário
          </Label>
          <p className="text-xs text-muted-foreground mt-0.5">
            Enviamos apenas um aviso por dia, e só se você ainda não registrou treino.
          </p>
        </div>
        <Switch
          id="reminder-enabled"
          disabled={isLoading}
          checked={local.enabled}
          onCheckedChange={(v) => patch({ enabled: v })}
        />
      </div>

      <div className="mt-5 flex items-center justify-between gap-4">
        <Label htmlFor="reminder-time" className="text-base">
          Horário do lembrete
        </Label>
        <input
          id="reminder-time"
          type="time"
          value={local.remindAt}
          disabled={isLoading || !local.enabled}
          onChange={(e) => patch({ remindAt: e.target.value })}
          className="h-10 rounded-lg border border-input bg-background px-3 text-sm disabled:opacity-50"
        />
      </div>

      <div className="mt-5">
        <Label className="text-base">Meus dias de descanso</Label>
        <p className="text-xs text-muted-foreground mt-0.5 mb-3">
          Nenhum lembrete é enviado nos dias marcados.
        </p>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Dias de descanso">
          {DAYS.map((d) => {
            const active = local.restDays.includes(d.value);
            return (
              <button
                key={d.value}
                type="button"
                aria-pressed={active}
                disabled={isLoading || !local.enabled}
                onClick={() => toggleDay(d.value)}
                className={cn(
                  "min-w-12 rounded-full border px-3 py-2 text-xs font-semibold transition disabled:opacity-50",
                  active
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background text-muted-foreground hover:text-foreground",
                )}
              >
                {d.label}
              </button>
            );
          })}
        </div>
      </div>

      {dirty && (
        <Button className="mt-5 w-full" onClick={commit} disabled={mutation.isPending}>
          {mutation.isPending ? "Salvando..." : "Salvar lembretes"}
        </Button>
      )}
    </section>
  );
}
