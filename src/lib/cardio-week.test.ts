import { describe, it, expect } from "vitest";
import { combineTimeline, cargaCardioSemana, type ExtraActivity } from "./daily-suggestion";
import { weekStart } from "./week";

// Dados reais do usuário (UTC) — sábado 2026-08-01, semana começa domingo 26/07.
const now = new Date("2026-08-01T05:23:00.000Z");

const extras: ExtraActivity[] = [
  // Pedaladas duplicadas (Strava importou 2x) — SÁBADO 25/07, semana anterior
  { started_at: "2026-07-25T18:09:03Z", ended_at: "2026-07-25T19:53:42Z", activity_name: "Pedalada da tarde", duration_min: 105 },
  { started_at: "2026-07-25T18:09:38Z", ended_at: "2026-07-25T19:52:28Z", activity_name: "Afternoon Ride", duration_min: 103 },
  // Caminhadas (cardio baixo) na semana atual
  { started_at: "2026-07-27T20:39:53Z", ended_at: "2026-07-27T21:02:23Z", activity_name: "Caminhada vespertina", duration_min: 23 },
  { started_at: "2026-07-30T19:39:00Z", ended_at: "2026-07-30T20:04:00Z", activity_name: "Caminhada vespertina", duration_min: 25 },
];

describe("cardio da semana (domingo → hoje)", () => {
  it("a semana começa no domingo", () => {
    expect(weekStart(now).getDay()).toBe(0);
  });

  it("não conta pedaladas do sábado anterior", () => {
    const c = cargaCardioSemana(combineTimeline([], extras, now), now);
    expect(c.minutos).toBe(0);
    expect(c.sessoesIntensas).toBe(0);
    expect(c.sessoes).toBe(0);
  });

  it("deduplica a mesma atividade importada duas vezes", () => {
    const dom = new Date("2026-07-27T12:00:00Z");
    const dupes: ExtraActivity[] = [
      { started_at: "2026-07-26T18:09:03Z", ended_at: null, activity_name: "Pedalada da tarde", duration_min: 105 },
      { started_at: "2026-07-26T18:09:38Z", ended_at: null, activity_name: "Afternoon Ride", duration_min: 103 },
    ];
    const c = cargaCardioSemana(combineTimeline([], dupes, dom), dom);
    expect(c.sessoes).toBe(1);
    expect(c.duplicadasIgnoradas).toBe(1);
    expect(c.minutos).toBe(105);
  });

  it("limita duração absurda a 300min", () => {
    const d = new Date("2026-07-28T12:00:00Z");
    const c = cargaCardioSemana(
      combineTimeline([], [{ started_at: "2026-07-27T10:00:00Z", ended_at: null, activity_name: "Corrida", duration_min: 900 }], d),
      d,
    );
    expect(c.minutos).toBe(300);
  });
});
