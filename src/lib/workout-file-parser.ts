// Parses .gpx / .tcx (XML) and .fit (binary) workout files entirely in the browser.
// Returns a normalized shape suitable for inserting into `public.sessions`.
//
// `fit-file-parser` (~833KB) and its `buffer` polyfill are heavy and only
// needed when the user actually drops a .fit file. They are dynamically
// imported inside `parseFit()` so the historico route bundle stays small.



export type ParsedWorkout = {
  started_at: string; // ISO
  ended_at: string; // ISO
  activity_type: string | null; // "running" | "cycling" | "swimming" | "walking" | "strength" | string
  distance_m: number | null;
  avg_hr: number | null;
  max_hr: number | null;
  calories: number | null;
  source: "import_fit" | "import_gpx" | "import_tcx";
};

export type ParseError = { message: string };

function toIso(d: Date | string | number | undefined | null): string | null {
  if (!d) return null;
  const date = d instanceof Date ? d : new Date(d);
  if (isNaN(date.getTime())) return null;
  return date.toISOString();
}

function haversineMeters(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const R = 6371000;
  const toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}

// ----------------- GPX -----------------
function parseGpx(text: string): ParsedWorkout {
  const doc = new DOMParser().parseFromString(text, "application/xml");
  const parseError = doc.querySelector("parsererror");
  if (parseError) throw new Error("Arquivo GPX inválido");

  const trkpts = Array.from(doc.getElementsByTagName("trkpt"));
  if (trkpts.length === 0) throw new Error("GPX sem pontos de rastreamento");

  const points: { lat: number; lon: number; time: Date | null; hr: number | null }[] = trkpts.map((p) => {
    const lat = parseFloat(p.getAttribute("lat") ?? "0");
    const lon = parseFloat(p.getAttribute("lon") ?? "0");
    const timeEl = p.getElementsByTagName("time")[0];
    const time = timeEl?.textContent ? new Date(timeEl.textContent) : null;
    // hr may live under extensions/gpxtpx:TrackPointExtension/gpxtpx:hr
    const hrEl = p.getElementsByTagNameNS("*", "hr")[0];
    const hr = hrEl?.textContent ? parseInt(hrEl.textContent, 10) : null;
    return { lat, lon, time, hr: Number.isFinite(hr!) ? hr : null };
  });

  let distance = 0;
  for (let i = 1; i < points.length; i++) distance += haversineMeters(points[i - 1], points[i]);

  const hrs = points.map((p) => p.hr).filter((h): h is number => h !== null && h > 0);
  const avg_hr = hrs.length ? Math.round(hrs.reduce((a, b) => a + b, 0) / hrs.length) : null;
  const max_hr = hrs.length ? Math.max(...hrs) : null;

  const first = points.find((p) => p.time);
  const last = [...points].reverse().find((p) => p.time);
  const started_at = toIso(first?.time ?? null) ?? new Date().toISOString();
  const ended_at = toIso(last?.time ?? null) ?? started_at;

  const typeEl = doc.querySelector("trk > type");
  const activity_type = typeEl?.textContent?.toLowerCase().trim() || null;

  return {
    started_at,
    ended_at,
    activity_type,
    distance_m: Math.round(distance) || null,
    avg_hr,
    max_hr,
    calories: null,
    source: "import_gpx",
  };
}

// ----------------- TCX -----------------
function parseTcx(text: string): ParsedWorkout {
  const doc = new DOMParser().parseFromString(text, "application/xml");
  const parseError = doc.querySelector("parsererror");
  if (parseError) throw new Error("Arquivo TCX inválido");

  const activity = doc.getElementsByTagName("Activity")[0];
  if (!activity) throw new Error("TCX sem atividade");

  const activity_type = activity.getAttribute("Sport")?.toLowerCase() || null;

  const laps = Array.from(activity.getElementsByTagName("Lap"));
  let distance = 0;
  let calories = 0;
  let totalHrSum = 0;
  let totalHrCount = 0;
  let maxHr = 0;

  for (const lap of laps) {
    const d = parseFloat(lap.getElementsByTagName("DistanceMeters")[0]?.textContent ?? "0");
    if (Number.isFinite(d)) distance += d;
    const c = parseInt(lap.getElementsByTagName("Calories")[0]?.textContent ?? "0", 10);
    if (Number.isFinite(c)) calories += c;

    const avgHrEl = lap.getElementsByTagName("AverageHeartRateBpm")[0];
    const avgHrVal = parseInt(avgHrEl?.getElementsByTagName("Value")[0]?.textContent ?? "0", 10);
    if (avgHrVal > 0) {
      totalHrSum += avgHrVal;
      totalHrCount++;
    }
    const maxHrEl = lap.getElementsByTagName("MaximumHeartRateBpm")[0];
    const maxHrVal = parseInt(maxHrEl?.getElementsByTagName("Value")[0]?.textContent ?? "0", 10);
    if (maxHrVal > maxHr) maxHr = maxHrVal;
  }

  const firstLapStart = laps[0]?.getAttribute("StartTime");
  const started_at = toIso(firstLapStart) ?? new Date().toISOString();

  // ended_at: last trackpoint time in last lap, else start + total TotalTimeSeconds
  let ended_at: string | null = null;
  const lastLap = laps[laps.length - 1];
  if (lastLap) {
    const trackpoints = lastLap.getElementsByTagName("Trackpoint");
    const lastTp = trackpoints[trackpoints.length - 1];
    ended_at = toIso(lastTp?.getElementsByTagName("Time")[0]?.textContent);
    if (!ended_at) {
      const totalSecs = laps.reduce(
        (a, l) => a + parseFloat(l.getElementsByTagName("TotalTimeSeconds")[0]?.textContent ?? "0"),
        0,
      );
      ended_at = new Date(new Date(started_at).getTime() + totalSecs * 1000).toISOString();
    }
  }

  return {
    started_at,
    ended_at: ended_at ?? started_at,
    activity_type,
    distance_m: Math.round(distance) || null,
    avg_hr: totalHrCount ? Math.round(totalHrSum / totalHrCount) : null,
    max_hr: maxHr || null,
    calories: calories || null,
    source: "import_tcx",
  };
}

// ----------------- FIT -----------------
async function parseFit(buffer: ArrayBuffer): Promise<ParsedWorkout> {
  // Buffer polyfill MUST be installed on globalThis BEFORE fit-file-parser is
  // evaluated — the library references the Buffer global at module load time.
  const bufferMod: any = await import("buffer");
  const BufferPolyfill: any = bufferMod.Buffer ?? bufferMod.default?.Buffer ?? bufferMod.default;
  if (typeof globalThis !== "undefined" && !(globalThis as any).Buffer) {
    (globalThis as any).Buffer = BufferPolyfill;
  }
  const { default: FitParser } = await import("fit-file-parser");
  return new Promise((resolve, reject) => {
    const parser = new FitParser({
      force: true,
      speedUnit: "m/s",
      lengthUnit: "m",
      elapsedRecordField: true,
    });
    parser.parse(BufferPolyfill.from(new Uint8Array(buffer)) as any, (err: string | undefined, data: any) => {
      if (err) return reject(new Error(`Falha ao ler .fit: ${err}`));
      try {
        const session = Array.isArray(data.sessions) ? data.sessions[0] : data.sessions;
        const activity = data.activity;
        const records: any[] = data.records ?? [];

        const started_at =
          toIso(session?.start_time) ??
          toIso(activity?.timestamp) ??
          toIso(records[0]?.timestamp) ??
          new Date().toISOString();

        const totalElapsed = session?.total_elapsed_time ?? session?.total_timer_time ?? 0;
        const ended_at =
          toIso(session?.timestamp) ??
          toIso(records[records.length - 1]?.timestamp) ??
          new Date(new Date(started_at).getTime() + totalElapsed * 1000).toISOString();

        const hrs = records.map((r) => r.heart_rate).filter((h: number) => typeof h === "number" && h > 0);
        const avg_hr =
          session?.avg_heart_rate ??
          (hrs.length ? Math.round(hrs.reduce((a: number, b: number) => a + b, 0) / hrs.length) : null);
        const max_hr =
          session?.max_heart_rate ?? (hrs.length ? Math.max(...(hrs as number[])) : null);

        resolve({
          started_at,
          ended_at,
          activity_type: session?.sport ?? activity?.type ?? null,
          distance_m: session?.total_distance ? Math.round(session.total_distance) : null,
          avg_hr: avg_hr ?? null,
          max_hr: max_hr ?? null,
          calories: session?.total_calories ?? null,
          source: "import_fit",
        });
      } catch (e: any) {
        reject(new Error(`Não foi possível extrair dados: ${e.message ?? e}`));
      }
    });
  });
}


// ----------------- Dispatcher -----------------
export async function parseWorkoutFile(file: File): Promise<ParsedWorkout> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".gpx")) {
    const text = await file.text();
    return parseGpx(text);
  }
  if (name.endsWith(".tcx")) {
    const text = await file.text();
    return parseTcx(text);
  }
  if (name.endsWith(".fit")) {
    const buf = await file.arrayBuffer();
    return parseFit(buf);
  }
  throw new Error("Formato não suportado. Use .fit, .gpx ou .tcx.");
}

export function translateActivityType(t: string | null): string {
  if (!t) return "Atividade";
  const map: Record<string, string> = {
    running: "Corrida",
    run: "Corrida",
    cycling: "Ciclismo",
    biking: "Ciclismo",
    bike: "Ciclismo",
    walking: "Caminhada",
    walk: "Caminhada",
    hiking: "Trilha",
    swimming: "Natação",
    swim: "Natação",
    training: "Treino",
    strength_training: "Musculação",
    strength: "Musculação",
    other: "Outro",
  };
  return map[t.toLowerCase()] ?? t.charAt(0).toUpperCase() + t.slice(1);
}
