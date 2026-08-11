// Tipos e defaults das preferências de lembrete de treino.
// Módulo client-safe: pode ser importado tanto no navegador quanto no servidor.

export type ReminderSettings = {
  enabled: boolean;
  emailEnabled: boolean;
  remindAt: string; // "HH:MM"
  restDays: number[]; // 0=Dom ... 6=Sáb
  timezone: string;
};

export const DEFAULT_REMINDER_SETTINGS: ReminderSettings = {
  enabled: true,
  emailEnabled: false,
  remindAt: "09:00",
  restDays: [],
  timezone: "America/Sao_Paulo",
};
