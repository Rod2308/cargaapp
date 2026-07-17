// Parses .gpx / .tcx (XML) and .fit (binary) workout files entirely in the browser.
// Returns a normalized shape suitable for inserting into `public.sessions`.
//
// FIT is parsed with a small native reader below to avoid browser/SSR polyfill
// issues from Node-oriented FIT packages.



export type ParsedWorkout = {
  started_at: string; // ISO
  ended_at: string; // ISO
  activity_type: string | null; // "running" | "cycling" | "swimming" | "walking" | "strength" | string
  distance_m: number | null;
  avg_hr: number | null;
  max_hr: number | null;
  calories: number | null;
  elevation_gain_m: number | null;
  elevation_loss_m: number | null;
  // GeoJSON LineString com pontos [lon, lat] — leve o suficiente para armazenar em jsonb.
  route_geojson: { type: "LineString"; coordinates: [number, number][] } | null;
  source: "import_fit" | "import_gpx" | "import_tcx";
};

export type ParseError = { message: string };

function elevationDeltas(elevations: Array<number | null | undefined>): { gain: number; loss: number } {
  let gain = 0;
  let loss = 0;
  let previous: number | null = null;
  for (const value of elevations) {
    if (typeof value !== "number" || !Number.isFinite(value)) continue;
    if (previous !== null) {
      const delta = value - previous;
      // Ignora ruído (<0.5m) — típico de altímetros barométricos.
      if (delta > 0.5) gain += delta;
      else if (delta < -0.5) loss += -delta;
    }
    previous = value;
  }
  return { gain: Math.round(gain), loss: Math.round(loss) };
}

function toRoute(points: Array<{ lat: number; lon: number }>): ParsedWorkout["route_geojson"] {
  const valid = points.filter(
    (p) => Number.isFinite(p.lat) && Number.isFinite(p.lon) && (p.lat !== 0 || p.lon !== 0),
  );
  if (valid.length < 2) return null;
  // Downsample para no máximo ~500 pontos — mantém shape em jsonb sem estourar.
  const step = Math.max(1, Math.floor(valid.length / 500));
  const coords: [number, number][] = [];
  for (let i = 0; i < valid.length; i += step) coords.push([+valid[i].lon.toFixed(6), +valid[i].lat.toFixed(6)]);
  if (coords[coords.length - 1] !== undefined) {
    const last = valid[valid.length - 1];
    coords.push([+last.lon.toFixed(6), +last.lat.toFixed(6)]);
  }
  return { type: "LineString", coordinates: coords };
}

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

function semicirclesToDegrees(value: number): number {
  return (value * 180) / 2 ** 31;
}

function mean(values: number[]): number | null {
  return values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : null;
}

function positiveSum(values: Array<number | null | undefined>): number | null {
  const total = values.reduce<number>((sum, value) => sum + (typeof value === "number" && value > 0 ? value : 0), 0);
  return total > 0 ? total : null;
}

function firstPositive(values: Array<number | null | undefined>): number | null {
  return values.find((value): value is number => typeof value === "number" && value > 0) ?? null;
}

// ----------------- GPX -----------------
function parseGpx(text: string): ParsedWorkout {
  const doc = new DOMParser().parseFromString(text, "application/xml");
  const parseError = doc.querySelector("parsererror");
  if (parseError) throw new Error("Arquivo GPX inválido");

  const trkpts = Array.from(doc.getElementsByTagName("trkpt"));
  if (trkpts.length === 0) throw new Error("GPX sem pontos de rastreamento");

  const points: { lat: number; lon: number; time: Date | null; hr: number | null; ele: number | null }[] = trkpts.map((p) => {
    const lat = parseFloat(p.getAttribute("lat") ?? "0");
    const lon = parseFloat(p.getAttribute("lon") ?? "0");
    const timeEl = p.getElementsByTagName("time")[0];
    const time = timeEl?.textContent ? new Date(timeEl.textContent) : null;
    const hrEl = p.getElementsByTagNameNS("*", "hr")[0];
    const hr = hrEl?.textContent ? parseInt(hrEl.textContent, 10) : null;
    const eleEl = p.getElementsByTagName("ele")[0];
    const ele = eleEl?.textContent ? parseFloat(eleEl.textContent) : null;
    return { lat, lon, time, hr: Number.isFinite(hr!) ? hr : null, ele: Number.isFinite(ele!) ? ele : null };
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

  const { gain, loss } = elevationDeltas(points.map((p) => p.ele));

  return {
    started_at,
    ended_at,
    activity_type,
    distance_m: Math.round(distance) || null,
    avg_hr,
    max_hr,
    calories: null,
    elevation_gain_m: gain || null,
    elevation_loss_m: loss || null,
    route_geojson: toRoute(points),
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

  // Coleta trackpoints para elevação + rota.
  const tps = Array.from(activity.getElementsByTagName("Trackpoint"));
  const elevations: (number | null)[] = [];
  const coords: { lat: number; lon: number }[] = [];
  for (const tp of tps) {
    const alt = parseFloat(tp.getElementsByTagName("AltitudeMeters")[0]?.textContent ?? "");
    elevations.push(Number.isFinite(alt) ? alt : null);
    const pos = tp.getElementsByTagName("Position")[0];
    if (pos) {
      const lat = parseFloat(pos.getElementsByTagName("LatitudeDegrees")[0]?.textContent ?? "");
      const lon = parseFloat(pos.getElementsByTagName("LongitudeDegrees")[0]?.textContent ?? "");
      if (Number.isFinite(lat) && Number.isFinite(lon)) coords.push({ lat, lon });
    }
  }

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

  const { gain, loss } = elevationDeltas(elevations);

  return {
    started_at,
    ended_at: ended_at ?? started_at,
    activity_type,
    distance_m: Math.round(distance) || null,
    avg_hr: totalHrCount ? Math.round(totalHrSum / totalHrCount) : null,
    max_hr: maxHr || null,
    calories: calories || null,
    elevation_gain_m: gain || null,
    elevation_loss_m: loss || null,
    route_geojson: toRoute(coords),
    source: "import_tcx",
  };
}

// ----------------- FIT -----------------
// Tolerant to alternative FIT layouts (Garmin, Wahoo, Coros, Suunto, Zwift,
// Polar, Stryd etc.): sessions/laps/records may be missing individually.
type FitFieldDefinition = { fieldNumber: number; size: number; baseType: number };
type FitDefinition = {
  globalMessageNumber: number;
  littleEndian: boolean;
  fields: FitFieldDefinition[];
  developerBytes: number;
};
type FitRecord = { timestamp?: number; distance?: number; heartRate?: number; lat?: number; lon?: number; altitude?: number };
type FitAggregate = {
  timestamp?: number;
  startTime?: number;
  totalElapsed?: number;
  totalTimer?: number;
  distance?: number;
  calories?: number;
  avgHr?: number;
  maxHr?: number;
  sport?: number;
};

const FIT_EPOCH_MS = Date.UTC(1989, 11, 31);

function fitDateToIso(seconds: number | null | undefined): string | null {
  if (typeof seconds !== "number" || !Number.isFinite(seconds) || seconds <= 0) return null;
  return new Date(FIT_EPOCH_MS + seconds * 1000).toISOString();
}

function sportCodeToActivity(code: number | null): string | null {
  const map: Record<number, string> = {
    1: "running",
    2: "cycling",
    5: "swimming",
    10: "training",
    11: "walking",
    17: "hiking",
    37: "cycling",
    42: "walking",
  };
  return code == null ? null : map[code] ?? "training";
}

function baseTypeSize(baseType: number): number | null {
  const sizes: Record<number, number> = {
    0: 1,
    1: 1,
    2: 1,
    3: 2,
    4: 2,
    5: 4,
    6: 4,
    7: 1,
    8: 4,
    9: 8,
    10: 1,
    11: 2,
    12: 4,
    13: 1,
    14: 8,
    15: 8,
    16: 8,
  };
  return sizes[baseType & 0x1f] ?? null;
}

function decodeFitScalar(view: DataView, offset: number, baseType: number, littleEndian: boolean): number | null {
  const type = baseType & 0x1f;
  switch (type) {
    case 0: {
      const value = view.getUint8(offset);
      return value === 0xff ? null : value;
    }
    case 1: {
      const value = view.getInt8(offset);
      return value === 0x7f ? null : value;
    }
    case 2: {
      const value = view.getUint8(offset);
      return value === 0xff ? null : value;
    }
    case 3: {
      const value = view.getInt16(offset, littleEndian);
      return value === 0x7fff ? null : value;
    }
    case 4: {
      const value = view.getUint16(offset, littleEndian);
      return value === 0xffff ? null : value;
    }
    case 5: {
      const value = view.getInt32(offset, littleEndian);
      return value === 0x7fffffff ? null : value;
    }
    case 6: {
      const value = view.getUint32(offset, littleEndian);
      return value === 0xffffffff ? null : value;
    }
    case 8: {
      const value = view.getFloat32(offset, littleEndian);
      return Number.isFinite(value) ? value : null;
    }
    case 9: {
      const value = view.getFloat64(offset, littleEndian);
      return Number.isFinite(value) ? value : null;
    }
    case 10: {
      const value = view.getUint8(offset);
      return value === 0 ? null : value;
    }
    case 11: {
      const value = view.getUint16(offset, littleEndian);
      return value === 0 ? null : value;
    }
    case 12: {
      const value = view.getUint32(offset, littleEndian);
      return value === 0 ? null : value;
    }
    case 13:
      return view.getUint8(offset);
    case 14: {
      const value = view.getBigInt64(offset, littleEndian);
      return value === 0x7fffffffffffffffn ? null : Number(value);
    }
    case 15: {
      const value = view.getBigUint64(offset, littleEndian);
      return value === 0xffffffffffffffffn ? null : Number(value);
    }
    case 16: {
      const value = view.getBigUint64(offset, littleEndian);
      return value === 0n ? null : Number(value);
    }
    default:
      return null;
  }
}

function decodeFitField(
  view: DataView,
  bytes: Uint8Array,
  offset: number,
  field: FitFieldDefinition,
  littleEndian: boolean,
): number | string | null {
  const type = field.baseType & 0x1f;
  if (type === 7) {
    const raw = bytes.slice(offset, offset + field.size);
    const end = raw.indexOf(0);
    return new TextDecoder().decode(end >= 0 ? raw.slice(0, end) : raw).trim() || null;
  }

  const size = baseTypeSize(field.baseType);
  if (!size || field.size < size) return null;

  const values: number[] = [];
  for (let i = 0; i + size <= field.size; i += size) {
    const value = decodeFitScalar(view, offset + i, field.baseType, littleEndian);
    if (value !== null) values.push(value);
  }
  if (!values.length) return null;
  return values[0];
}

function numberField(message: Record<number, number | string | null>, fieldNumber: number): number | null {
  const value = message[fieldNumber];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function readFitDefinition(view: DataView, offset: number, dataEnd: number, header: number): { definition: FitDefinition; offset: number } {
  if (offset + 6 > dataEnd) throw new Error("Definição FIT incompleta");
  offset += 1; // reserved
  const architecture = view.getUint8(offset++);
  const littleEndian = architecture === 0;
  const globalMessageNumber = view.getUint16(offset, littleEndian);
  offset += 2;
  const fieldCount = view.getUint8(offset++);
  if (offset + fieldCount * 3 > dataEnd) throw new Error("Campos FIT incompletos");

  const fields: FitFieldDefinition[] = [];
  for (let i = 0; i < fieldCount; i++) {
    fields.push({ fieldNumber: view.getUint8(offset), size: view.getUint8(offset + 1), baseType: view.getUint8(offset + 2) });
    offset += 3;
  }

  let developerBytes = 0;
  if (header & 0x20) {
    if (offset >= dataEnd) throw new Error("Campos extras FIT incompletos");
    const developerFieldCount = view.getUint8(offset++);
    if (offset + developerFieldCount * 3 > dataEnd) throw new Error("Campos extras FIT incompletos");
    for (let i = 0; i < developerFieldCount; i++) {
      developerBytes += view.getUint8(offset + 1);
      offset += 3;
    }
  }

  return { definition: { globalMessageNumber, littleEndian, fields, developerBytes }, offset };
}

function extractFitMessage(globalMessageNumber: number, message: Record<number, number | string | null>) {
  switch (globalMessageNumber) {
    case 20: {
      // altitude: campo 2 (uint16, escala 5, offset 500) — enhanced_altitude fica em 78.
      const altRaw = numberField(message, 2);
      const altEnh = numberField(message, 78);
      const altitude =
        altEnh != null ? altEnh / 5 - 500 : altRaw != null ? altRaw / 5 - 500 : undefined;
      return {
        kind: "record" as const,
        value: {
          timestamp: numberField(message, 253) ?? undefined,
          lat: numberField(message, 0) != null ? semicirclesToDegrees(numberField(message, 0)!) : undefined,
          lon: numberField(message, 1) != null ? semicirclesToDegrees(numberField(message, 1)!) : undefined,
          heartRate: numberField(message, 3) ?? undefined,
          distance: numberField(message, 5) != null ? numberField(message, 5)! / 100 : undefined,
          altitude,
        } satisfies FitRecord,
      };
    }
    case 18:
      return {
        kind: "session" as const,
        value: {
          timestamp: numberField(message, 253) ?? undefined,
          startTime: numberField(message, 2) ?? undefined,
          sport: numberField(message, 5) ?? undefined,
          totalElapsed: numberField(message, 7) != null ? numberField(message, 7)! / 1000 : undefined,
          totalTimer: numberField(message, 8) != null ? numberField(message, 8)! / 1000 : undefined,
          distance: numberField(message, 9) != null ? numberField(message, 9)! / 100 : undefined,
          calories: numberField(message, 11) ?? undefined,
          avgHr: numberField(message, 16) ?? undefined,
          maxHr: numberField(message, 17) ?? undefined,
        } satisfies FitAggregate,
      };
    case 19:
      return {
        kind: "lap" as const,
        value: {
          timestamp: numberField(message, 253) ?? undefined,
          startTime: numberField(message, 2) ?? undefined,
          totalElapsed: numberField(message, 7) != null ? numberField(message, 7)! / 1000 : undefined,
          totalTimer: numberField(message, 8) != null ? numberField(message, 8)! / 1000 : undefined,
          distance: numberField(message, 9) != null ? numberField(message, 9)! / 100 : undefined,
          calories: numberField(message, 11) ?? undefined,
          avgHr: numberField(message, 15) ?? undefined,
          maxHr: numberField(message, 16) ?? undefined,
          sport: numberField(message, 26) ?? undefined,
        } satisfies FitAggregate,
      };
    case 34:
      return {
        kind: "activity" as const,
        value: {
          timestamp: numberField(message, 253) ?? undefined,
          totalTimer: numberField(message, 0) != null ? numberField(message, 0)! / 1000 : undefined,
        } satisfies FitAggregate,
      };
    case 12:
      return { kind: "sport" as const, value: { sport: numberField(message, 0) ?? undefined } satisfies FitAggregate };
    default:
      return null;
  }
}

function parseFit(buffer: ArrayBuffer): ParsedWorkout {
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);
  if (bytes.length < 14) throw new Error("Arquivo FIT vazio ou incompleto");

  const headerSize = view.getUint8(0);
  const fileType = String.fromCharCode(bytes[8], bytes[9], bytes[10], bytes[11]);
  if ((headerSize !== 12 && headerSize !== 14) || fileType !== ".FIT") {
    throw new Error("Arquivo FIT inválido ou corrompido");
  }

  const declaredDataSize = view.getUint32(4, true);
  const dataStart = headerSize;
  const dataEnd = Math.min(bytes.length - 2, dataStart + declaredDataSize);
  if (dataEnd <= dataStart) throw new Error("Arquivo FIT sem dados de treino");

  const definitions = new Map<number, FitDefinition>();
  const records: FitRecord[] = [];
  const sessions: FitAggregate[] = [];
  const laps: FitAggregate[] = [];
  const activities: FitAggregate[] = [];
  const sports: FitAggregate[] = [];
  let offset = dataStart;
  let lastTimestamp: number | null = null;

  while (offset < dataEnd) {
    const header = view.getUint8(offset++);
    const compressedTimestamp = header & 0x80 ? header & 0x1f : null;
    const localMessageNumber = header & 0x80 ? (header >> 5) & 0x03 : header & 0x0f;

    if (!(header & 0x80) && header & 0x40) {
      const result = readFitDefinition(view, offset, dataEnd, header);
      definitions.set(localMessageNumber, result.definition);
      offset = result.offset;
      continue;
    }

    const definition = definitions.get(localMessageNumber);
    if (!definition) break;

    const message: Record<number, number | string | null> = {};
    for (const field of definition.fields) {
      if (offset + field.size > dataEnd) throw new Error("Mensagem FIT incompleta");
      message[field.fieldNumber] = decodeFitField(view, bytes, offset, field, definition.littleEndian);
      offset += field.size;
    }
    offset += definition.developerBytes;

    if (compressedTimestamp !== null && message[253] == null && lastTimestamp != null) {
      const base = lastTimestamp - (lastTimestamp % 32);
      const reconstructed = base + compressedTimestamp + (compressedTimestamp < lastTimestamp % 32 ? 32 : 0);
      message[253] = reconstructed;
    }

    const timestamp = numberField(message, 253);
    if (timestamp != null) lastTimestamp = timestamp;

    const extracted = extractFitMessage(definition.globalMessageNumber, message);
    if (!extracted) continue;
    if (extracted.kind === "record") records.push(extracted.value);
    if (extracted.kind === "session") sessions.push(extracted.value);
    if (extracted.kind === "lap") laps.push(extracted.value);
    if (extracted.kind === "activity") activities.push(extracted.value);
    if (extracted.kind === "sport") sports.push(extracted.value);
  }

  if (!sessions.length && !laps.length && !records.length) {
    throw new Error("FIT sem sessões, voltas ou pontos de treino reconhecidos");
  }

  const startSeconds = Math.min(
    ...[...sessions.map((s) => s.startTime), ...laps.map((l) => l.startTime), ...records.map((r) => r.timestamp)]
      .filter((value): value is number => typeof value === "number" && value > 0),
  );
  const fallbackStart = Number.isFinite(startSeconds) ? startSeconds : null;
  const totalElapsed = positiveSum([...sessions.map((s) => s.totalElapsed ?? s.totalTimer), ...laps.map((l) => l.totalElapsed ?? l.totalTimer)]);
  const endSeconds = Math.max(
    ...[...sessions.map((s) => s.timestamp), ...laps.map((l) => l.timestamp), ...records.map((r) => r.timestamp)]
      .filter((value): value is number => typeof value === "number" && value > 0),
  );

  const started_at = fitDateToIso(fallbackStart) ?? new Date().toISOString();
  const ended_at =
    fitDateToIso(Number.isFinite(endSeconds) ? endSeconds : null) ??
    new Date(new Date(started_at).getTime() + (totalElapsed ?? 0) * 1000).toISOString();

  const recordDistances = records.map((r) => r.distance).filter((value): value is number => typeof value === "number" && value > 0);
  let distance_m = positiveSum(sessions.map((s) => s.distance)) ?? positiveSum(laps.map((l) => l.distance));
  if (!distance_m && recordDistances.length) distance_m = Math.max(...recordDistances);
  if (!distance_m) {
    const points = records.filter((r): r is FitRecord & { lat: number; lon: number } => r.lat != null && r.lon != null);
    const gpsDistance = points.reduce((sum, point, index) => (index === 0 ? 0 : sum + haversineMeters(points[index - 1], point)), 0);
    if (gpsDistance > 0) distance_m = gpsDistance;
  }

  const recordHrs = records.map((r) => r.heartRate).filter((value): value is number => typeof value === "number" && value > 0);
  const avg_hr =
    mean(sessions.map((s) => s.avgHr).filter((value): value is number => typeof value === "number" && value > 0)) ??
    mean(laps.map((l) => l.avgHr).filter((value): value is number => typeof value === "number" && value > 0)) ??
    mean(recordHrs);
  const maxHrValues = [
    ...sessions.map((s) => s.maxHr),
    ...laps.map((l) => l.maxHr),
    ...recordHrs,
  ].filter((value): value is number => typeof value === "number" && value > 0);

  const sportCode = firstPositive([...sessions.map((s) => s.sport), ...laps.map((l) => l.sport), ...sports.map((s) => s.sport)]);

  const { gain: fitGain, loss: fitLoss } = elevationDeltas(records.map((r) => r.altitude));
  const fitCoords = records
    .filter((r): r is FitRecord & { lat: number; lon: number } => r.lat != null && r.lon != null)
    .map((r) => ({ lat: r.lat, lon: r.lon }));

  return {
    started_at,
    ended_at,
    activity_type: sportCodeToActivity(sportCode),
    distance_m: distance_m ? Math.round(distance_m) : null,
    avg_hr,
    max_hr: maxHrValues.length ? Math.max(...maxHrValues) : null,
    calories: positiveSum(sessions.map((s) => s.calories)) ?? positiveSum(laps.map((l) => l.calories)),
    elevation_gain_m: fitGain || null,
    elevation_loss_m: fitLoss || null,
    route_geojson: toRoute(fitCoords),
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
