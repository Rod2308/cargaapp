import { describe, it, expect } from "vitest";
import { localDateStr, weekStart, weekKey, localDaysBetween } from "./week";
import { combineTimeline, cargaCardioSemana, type ExtraActivity } from "./daily-suggestion";

const SP = "America/Sao_Paulo";
const TOKYO = "Asia/Tokyo";

describe("semana com fuso do usuário", () => {
  it("sábado 21h no Brasil não vira domingo", () => {
    const iso = "2026-08-02T00:30:00Z"; // 01/08 21:30 em São Paulo
    expect(localDateStr(iso, SP)).toBe("2026-08-01");
    expect(localDateStr(iso, "UTC")).toBe("2026-08-02"); // o bug antigo
  });

  it("semana começa domingo 00:00 no fuso informado", () => {
    const ws = weekStart("2026-08-01T23:00:00Z", SP);
    expect(localDateStr(ws, SP)).toBe("2026-07-26");
    expect(new Date(ws.toISOString()).toISOString()).toBe("2026-07-26T03:00:00.000Z");
    expect(weekKey("2026-08-01T23:00:00Z", SP)).toBe("2026-07-26");
  });

  it("respeita fusos à frente de UTC", () => {
    expect(localDateStr("2026-07-25T20:00:00Z", TOKYO)).toBe("2026-07-26"); // já é domingo? não, sábado→domingo
    expect(weekKey("2026-07-26T02:00:00Z", TOKYO)).toBe("2026-07-26");
  });

  it("cardio de sábado 21h fica na semana correta (não conta na semana seguinte)", () => {
    // Corrida sábado 01/08 21h em SP → 02/08 00h UTC.
    const extras: ExtraActivity[] = [
      { started_at: "2026-08-02T00:00:00Z", ended_at: null, activity_name: "Corrida", duration_min: 40 },
    ];
    const domingoSeguinte = new Date("2026-08-02T14:00:00Z"); // domingo 11h em SP
    const c = cargaCardioSemana(combineTimeline([], extras, domingoSeguinte, SP), domingoSeguinte, SP);
    expect(c.minutos).toBe(0); // ficou na semana passada, corretamente
  });

  it("dias civis locais são contados no fuso do usuário", () => {
    expect(localDaysBetween("2026-08-02T02:00:00Z", "2026-08-01T02:00:00Z", SP)).toBe(1);
    expect(localDaysBetween("2026-08-02T02:00:00Z", "2026-08-01T23:00:00Z", SP)).toBe(0);
  });
});
