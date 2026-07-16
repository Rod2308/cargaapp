// Parses .gpx / .tcx (XML) and .fit (binary) workout files entirely in the browser.
// Returns a normalized shape suitable for inserting into `public.sessions`.
//
// `@garmin/fitsdk` is only needed when the user actually
// drops a .fit file. It is dynamically imported inside `parseFit()` so the
// historico route bundle stays small.



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

function asArray<T = any>(value: T | T[] | null | undefined): T[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function firstValue(value: unknown): unknown {
  return Array.isArray(value) ? value[0] : value;
}

function readNumber(source: any, keys: string[]): number | null {
  for (const key of keys) {
    const value = firstValue(source?.[key]);
    if (typeof value === "number" && Number.isFinite(value)) return value;
  }
  return null;
}

function readDate(source: any, keys: string[]): string | null {
  for (const key of keys) {
    const iso = toIso(firstValue(source?.[key]) as Date | string | number | undefined | null);
    if (iso) return iso;
  }
  return null;
}

function fitSemicirclesToDegrees(value: number): number {
  return (value * 180) / 2 ** 31;
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
// Tolerant to alternative FIT layouts (Garmin, Wahoo, Coros, Suunto, Zwift,
// Polar, Stryd etc.): sessions/laps/records may be missing individually.
async function parseFit(buffer: ArrayBuffer): Promise<ParsedWorkout> {
  const { Decoder, Stream } = await import("@garmin/fitsdk");
  const stream = Stream.fromArrayBuffer(buffer);
  const decoder = new Decoder(stream);

  if (!decoder.isFIT()) throw new Error("Arquivo FIT inválido ou corrompido");

  const { messages, errors } = decoder.read({
    applyScaleAndOffset: true,
    expandSubFields: true,
    expandComponents: true,
    convertTypesToStrings: true,
    convertDateTimesToDates: true,
    includeUnknownData: false,
    mergeHeartRates: true,
  });

  const sessions = asArray(messages.sessionMesgs);
  const laps = asArray(messages.lapMesgs);
  const records = asArray(messages.recordMesgs);
  const activities = asArray(messages.activityMesgs);

  if (!sessions.length && !laps.length && !records.length) {
    const detail = errors?.[0]?.message ? `: ${errors[0].message}` : "";
    throw new Error(`FIT sem mensagens de treino reconhecidas${detail}`);
  }

  const session = sessions[0];
  const activity = activities[0];
  const started_at =
    readDate(session, ["startTime", "start_time"]) ??
    readDate(laps[0], ["startTime", "start_time"]) ??
    readDate(records[0], ["timestamp"]) ??
    readDate(activity, ["timestamp"]) ??
    new Date().toISOString();

  const totalElapsed =
    readNumber(session, ["totalElapsedTime", "total_elapsed_time"]) ??
    readNumber(session, ["totalTimerTime", "total_timer_time"]) ??
    laps.reduce(
      (sum, lap) => sum + (readNumber(lap, ["totalElapsedTime", "total_elapsed_time", "totalTimerTime", "total_timer_time"]) ?? 0),
      0,
    );
  const ended_at =
    readDate(session, ["timestamp"]) ??
    readDate(laps[laps.length - 1], ["timestamp"]) ??
    readDate(records[records.length - 1], ["timestamp"]) ??
    new Date(new Date(started_at).getTime() + (totalElapsed || 0) * 1000).toISOString();

  const recHr = records
    .map((record) => readNumber(record, ["heartRate", "heart_rate"]))
    .filter((value): value is number => value !== null && value > 0);
  const lapAvgHrs = laps
    .map((lap) => readNumber(lap, ["avgHeartRate", "avg_heart_rate"]))
    .filter((value): value is number => value !== null && value > 0);
  const lapMaxHrs = laps
    .map((lap) => readNumber(lap, ["maxHeartRate", "max_heart_rate"]))
    .filter((value): value is number => value !== null && value > 0);
  const avg_hr =
    readNumber(session, ["avgHeartRate", "avg_heart_rate"]) ??
    (lapAvgHrs.length ? Math.round(lapAvgHrs.reduce((a, b) => a + b, 0) / lapAvgHrs.length) : null) ??
    (recHr.length ? Math.round(recHr.reduce((a, b) => a + b, 0) / recHr.length) : null);
  const max_hr =
    readNumber(session, ["maxHeartRate", "max_heart_rate"]) ??
    (lapMaxHrs.length ? Math.max(...lapMaxHrs) : null) ??
    (recHr.length ? Math.max(...recHr) : null);

  let distance_m: number | null = null;
  const sessionDistance = readNumber(session, ["totalDistance", "total_distance"]);
  if (sessionDistance && sessionDistance > 0) distance_m = Math.round(sessionDistance);
  if (!distance_m) {
    const lapDist = laps.reduce((sum, lap) => sum + (readNumber(lap, ["totalDistance", "total_distance"]) ?? 0), 0);
    if (lapDist > 0) distance_m = Math.round(lapDist);
  }
  if (!distance_m) {
    const recDist = records
      .map((record) => readNumber(record, ["distance"]))
      .filter((value): value is number => value !== null && value > 0);
    if (recDist.length) distance_m = Math.round(Math.max(...recDist));
  }
  if (!distance_m) {
    const gpsPoints = records
      .map((record) => {
        const lat = readNumber(record, ["positionLat", "position_lat"]);
        const lon = readNumber(record, ["positionLong", "position_long"]);
        return lat !== null && lon !== null
          ? { lat: fitSemicirclesToDegrees(lat), lon: fitSemicirclesToDegrees(lon) }
          : null;
      })
      .filter((point): point is { lat: number; lon: number } => !!point);
    const gpsDistance = gpsPoints.reduce(
      (sum, point, index) => (index === 0 ? 0 : sum + haversineMeters(gpsPoints[index - 1], point)),
      0,
    );
    if (gpsDistance > 0) distance_m = Math.round(gpsDistance);
  }

  let calories: number | null = readNumber(session, ["totalCalories", "total_calories"]);
  if (calories == null) {
    const lapCals = laps.reduce((sum, lap) => sum + (readNumber(lap, ["totalCalories", "total_calories"]) ?? 0), 0);
    if (lapCals > 0) calories = Math.round(lapCals);
  }

  const activity_type =
    (firstValue(session?.sport) as string | undefined) ??
    (firstValue(laps[0]?.sport) as string | undefined) ??
    (firstValue(activity?.type) as string | undefined) ??
    null;

  return {
    started_at,
    ended_at,
    activity_type,
    distance_m: distance_m ?? null,
    avg_hr: avg_hr ?? null,
    max_hr: max_hr ?? null,
    calories: calories ?? null,
    source: "import_fit",
  };
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
