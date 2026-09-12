export type ActivityCategory =
  | "cardio_tradicional"
  | "esportes_coletivos"
  | "esportes_raquete"
  | "aquaticos"
  | "lutas_artes_marciais"
  | "funcional_cross"
  | "corrida_atletismo"
  | "ao_ar_livre"
  | "danca"
  | "corpo_mente"
  | "outros";

export interface ActivityCategoryDef {
  id: ActivityCategory;
  name: string;
  icon: string;
}

export const ACTIVITY_CATEGORIES: ActivityCategoryDef[] = [
  { id: "cardio_tradicional", name: "Cardio Tradicional", icon: "⚡" },
  { id: "corrida_atletismo", name: "Corrida & Atletismo", icon: "🏃" },
  { id: "esportes_coletivos", name: "Esportes Coletivos", icon: "⚽" },
  { id: "esportes_raquete", name: "Esportes de Raquete", icon: "🎾" },
  { id: "aquaticos", name: "Aquáticos", icon: "🏊" },
  { id: "lutas_artes_marciais", name: "Lutas & Artes Marciais", icon: "🥊" },
  { id: "funcional_cross", name: "Funcional & Cross", icon: "🔥" },
  { id: "ao_ar_livre", name: "Ao Ar Livre", icon: "🌲" },
  { id: "danca", name: "Dança", icon: "💃" },
  { id: "corpo_mente", name: "Corpo & Mente", icon: "🧘" },
  { id: "outros", name: "Outros", icon: "✨" },
];

export interface ActivityItem {
  id: string;
  name: string;
  category: ActivityCategory;
  supportsDistance?: boolean;
  supportsPace?: boolean;
  supportsIntensity?: boolean;
  defaultDurationMin?: number;
  aliases?: string[];
}

export const ACTIVITIES_CATALOG: ActivityItem[] = [
  // 1. Cardio Tradicional (Academia / Indoor)
  { id: "esteira", name: "Esteira", category: "cardio_tradicional", supportsDistance: true, supportsPace: true, supportsIntensity: true, defaultDurationMin: 30, aliases: ["treadmill", "caminhada na esteira", "corrida esteira"] },
  { id: "bike_indoor", name: "Bike Indoor / Spinning", category: "cardio_tradicional", supportsDistance: true, supportsIntensity: true, defaultDurationMin: 45, aliases: ["spinning", "bicicleta ergometrica", "cicloergometro", "bike academia"] },
  { id: "eliptico", name: "Elíptico / Transport", category: "cardio_tradicional", supportsDistance: true, supportsIntensity: true, defaultDurationMin: 30, aliases: ["transport", "cross trainer", "eliptica"] },
  { id: "escada", name: "Escada / Simulador", category: "cardio_tradicional", supportsIntensity: true, defaultDurationMin: 20, aliases: ["stairmaster", "climbmill", "degraus"] },
  { id: "remo_indoor", name: "Remo Indoor (Rowing)", category: "cardio_tradicional", supportsDistance: true, supportsPace: true, supportsIntensity: true, defaultDurationMin: 25, aliases: ["concept2", "remo ergometrico"] },
  { id: "air_bike", name: "Air Bike / Assault Bike", category: "cardio_tradicional", supportsIntensity: true, defaultDurationMin: 20, aliases: ["assault bike", "echo bike", "fan bike"] },
  { id: "ski_erg", name: "SkiErg", category: "cardio_tradicional", supportsDistance: true, supportsIntensity: true, defaultDurationMin: 20, aliases: ["ski", "esqui ergometro"] },
  { id: "cardio_academia", name: "Cardio Livre na Academia", category: "cardio_tradicional", supportsIntensity: true, defaultDurationMin: 30, aliases: ["aerobico academia", "aquecimento cardio"] },

  // 2. Corrida & Atletismo
  { id: "corrida_rua", name: "Corrida na Rua", category: "corrida_atletismo", supportsDistance: true, supportsPace: true, supportsIntensity: true, defaultDurationMin: 45, aliases: ["jogging", "running", "trotinho", "asfalto", "corrida"] },
  { id: "caminhada", name: "Caminhada", category: "corrida_atletismo", supportsDistance: true, supportsPace: true, supportsIntensity: true, defaultDurationMin: 40, aliases: ["walking", "passos"] },
  { id: "corrida_trilha", name: "Corrida em Trilha (Trail Run)", category: "corrida_atletismo", supportsDistance: true, supportsPace: true, supportsIntensity: true, defaultDurationMin: 60, aliases: ["trail run", "trilha corrida", "montanha"] },
  { id: "tiros_velocidade", name: "Tiros / Velocidade", category: "corrida_atletismo", supportsDistance: true, supportsIntensity: true, defaultDurationMin: 30, aliases: ["sprints", "treino intervalado", "pista atletismo"] },
  { id: "caminhada_ritmada", name: "Caminhada Ritmada / Power Walking", category: "corrida_atletismo", supportsDistance: true, supportsPace: true, supportsIntensity: true, defaultDurationMin: 45, aliases: ["power walking", "marcha"] },
  { id: "pular_corda", name: "Pular Corda", category: "corrida_atletismo", supportsIntensity: true, defaultDurationMin: 20, aliases: ["jump rope", "corda"] },

  // 3. Esportes Coletivos
  { id: "futebol", name: "Futebol", category: "esportes_coletivos", supportsIntensity: true, defaultDurationMin: 60, aliases: ["campo", "society", "pelada", "fut"] },
  { id: "futsal", name: "Futsal / Futebol de Salão", category: "esportes_coletivos", supportsIntensity: true, defaultDurationMin: 50, aliases: ["salao", "futebol de salao"] },
  { id: "futevolei", name: "Futevôlei", category: "esportes_coletivos", supportsIntensity: true, defaultDurationMin: 60, aliases: ["futvolei", "futevolei areia"] },
  { id: "volei", name: "Vôlei de Quadra", category: "esportes_coletivos", supportsIntensity: true, defaultDurationMin: 60, aliases: ["voleibol", "volleyball", "volei"] },
  { id: "volei_praia", name: "Vôlei de Praia / Areia", category: "esportes_coletivos", supportsIntensity: true, defaultDurationMin: 60, aliases: ["beach volleyball", "areia", "volei praia"] },
  { id: "basquete", name: "Basquete", category: "esportes_coletivos", supportsIntensity: true, defaultDurationMin: 60, aliases: ["basketball", "streetball", "tabela", "basquete 3x3"] },
  { id: "handebol", name: "Handebol", category: "esportes_coletivos", supportsIntensity: true, defaultDurationMin: 60, aliases: ["handball", "hand"] },
  { id: "peteca", name: "Peteca", category: "esportes_coletivos", supportsIntensity: true, defaultDurationMin: 45, aliases: ["jogo de peteca", "peteca praia", "peteca quadra"] },
  { id: "rugby", name: "Rugby", category: "esportes_coletivos", supportsIntensity: true, defaultDurationMin: 60, aliases: ["rugbi"] },
  { id: "futebol_americano", name: "Futebol Americano / Flag", category: "esportes_coletivos", supportsIntensity: true, defaultDurationMin: 60, aliases: ["flag football", "nfl"] },
  { id: "polo_aquatico", name: "Pólo Aquático", category: "esportes_coletivos", supportsIntensity: true, defaultDurationMin: 45, aliases: ["water polo"] },
  { id: "queimada", name: "Queimada / Dodgeball", category: "esportes_coletivos", supportsIntensity: true, defaultDurationMin: 40, aliases: ["dodgeball"] },
  { id: "ultimate_frisbee", name: "Ultimate Frisbee", category: "esportes_coletivos", supportsIntensity: true, defaultDurationMin: 50, aliases: ["frisbee"] },

  // 4. Esportes de Raquete
  { id: "beach_tennis", name: "Beach Tennis", category: "esportes_raquete", supportsIntensity: true, defaultDurationMin: 60, aliases: ["beach", "tenis de praia", "raquete areia"] },
  { id: "tenis", name: "Tênis", category: "esportes_raquete", supportsIntensity: true, defaultDurationMin: 60, aliases: ["tennis", "saibro", "quadra dura"] },
  { id: "padel", name: "Padel", category: "esportes_raquete", supportsIntensity: true, defaultDurationMin: 60, aliases: ["paddle"] },
  { id: "squash", name: "Squash", category: "esportes_raquete", supportsIntensity: true, defaultDurationMin: 45, aliases: ["squash court"] },
  { id: "tenis_mesa", name: "Tênis de Mesa / Ping Pong", category: "esportes_raquete", supportsIntensity: true, defaultDurationMin: 45, aliases: ["ping pong", "pingue pongue", "table tennis"] },
  { id: "badminton", name: "Badminton", category: "esportes_raquete", supportsIntensity: true, defaultDurationMin: 45, aliases: ["peteca com raquete"] },
  { id: "pickleball", name: "Pickleball", category: "esportes_raquete", supportsIntensity: true, defaultDurationMin: 60, aliases: ["pickle ball"] },
  { id: "frescobol", name: "Frescobol", category: "esportes_raquete", supportsIntensity: true, defaultDurationMin: 45, aliases: ["frescobol praia"] },

  // 5. Aquáticos
  { id: "natacao", name: "Natação", category: "aquaticos", supportsDistance: true, supportsPace: true, supportsIntensity: true, defaultDurationMin: 45, aliases: ["piscina", "crawl", "peito", "costas", "borboleta", "swimming"] },
  { id: "hidroginastica", name: "Hidroginástica", category: "aquaticos", supportsIntensity: true, defaultDurationMin: 50, aliases: ["aqua fitness", "hidro"] },
  { id: "surf", name: "Surf", category: "aquaticos", supportsIntensity: true, defaultDurationMin: 90, aliases: ["surfe", "ondas", "prancha"] },
  { id: "bodyboard", name: "Bodyboard", category: "aquaticos", supportsIntensity: true, defaultDurationMin: 60, aliases: ["pranchinha"] },
  { id: "stand_up_paddle", name: "Stand Up Paddle (SUP)", category: "aquaticos", supportsDistance: true, supportsIntensity: true, defaultDurationMin: 60, aliases: ["sup", "remada em pe"] },
  { id: "canoagem_caiaque", name: "Canoagem / Caiaque", category: "aquaticos", supportsDistance: true, supportsIntensity: true, defaultDurationMin: 60, aliases: ["caiaque", "canoa havaiana", "va'a", "kayak"] },
  { id: "mergulho", name: "Mergulho Livre / Snorkel", category: "aquaticos", supportsIntensity: true, defaultDurationMin: 45, aliases: ["apneia", "scuba", "snorkel"] },
  { id: "kitesurf", name: "Kitesurf / Windsurf", category: "aquaticos", supportsIntensity: true, defaultDurationMin: 90, aliases: ["kite", "windsurf", "vela"] },

  // 6. Lutas & Artes Marciais
  { id: "boxe", name: "Boxe", category: "lutas_artes_marciais", supportsIntensity: true, defaultDurationMin: 60, aliases: ["boxing", "nobre arte", "sparring"] },
  { id: "muay_thai", name: "Muay Thai", category: "lutas_artes_marciais", supportsIntensity: true, defaultDurationMin: 60, aliases: ["boxe tailandes", "thai"] },
  { id: "jiu_jitsu", name: "Jiu-Jitsu (BJJ)", category: "lutas_artes_marciais", supportsIntensity: true, defaultDurationMin: 75, aliases: ["bjj", "arte suave", "jiujitsu", "rolico", "tatame"] },
  { id: "judo", name: "Judô", category: "lutas_artes_marciais", supportsIntensity: true, defaultDurationMin: 60, aliases: ["judo", "quedas"] },
  { id: "karate", name: "Karatê", category: "lutas_artes_marciais", supportsIntensity: true, defaultDurationMin: 60, aliases: ["kata", "kumite"] },
  { id: "taekwondo", name: "Taekwondo", category: "lutas_artes_marciais", supportsIntensity: true, defaultDurationMin: 60, aliases: ["tkd"] },
  { id: "kickboxing", name: "Kickboxing / K-1", category: "lutas_artes_marciais", supportsIntensity: true, defaultDurationMin: 60, aliases: ["kick boxing"] },
  { id: "krav_maga", name: "Krav Magá / Defesa Pessoal", category: "lutas_artes_marciais", supportsIntensity: true, defaultDurationMin: 60, aliases: ["defesa pessoal", "krav maga"] },
  { id: "capoeira", name: "Capoeira", category: "lutas_artes_marciais", supportsIntensity: true, defaultDurationMin: 60, aliases: ["roda de capoeira", "ginga"] },
  { id: "mma", name: "MMA / Artes Marciais Mistas", category: "lutas_artes_marciais", supportsIntensity: true, defaultDurationMin: 60, aliases: ["mixed martial arts", "vale tudo"] },
  { id: "wrestling", name: "Wrestling / Luta Olímpica", category: "lutas_artes_marciais", supportsIntensity: true, defaultDurationMin: 60, aliases: ["greco romana", "luta livre"] },

  // 7. Funcional & Cross
  { id: "crossfit", name: "CrossFit / WOD", category: "funcional_cross", supportsIntensity: true, defaultDurationMin: 60, aliases: ["wod", "cross training", "metcon"] },
  { id: "treino_funcional", name: "Treino Funcional", category: "funcional_cross", supportsIntensity: true, defaultDurationMin: 50, aliases: ["functional training", "circuito"] },
  { id: "hiit", name: "HIIT / Treino Intervalado", category: "funcional_cross", supportsIntensity: true, defaultDurationMin: 25, aliases: ["tabata", "intervalado", "alta intensidade"] },
  { id: "calistenia", name: "Calistenia", category: "funcional_cross", supportsIntensity: true, defaultDurationMin: 45, aliases: ["street workout", "peso do corpo", "bodyweight"] },
  { id: "circuito_aerobico", name: "Circuito Aeróbico", category: "funcional_cross", supportsIntensity: true, defaultDurationMin: 40, aliases: ["circuit training", "queima caloria"] },
  { id: "hyrox", name: "HYROX / Corrida Funcional", category: "funcional_cross", supportsDistance: true, supportsIntensity: true, defaultDurationMin: 60, aliases: ["hyrox race", "fitness racing"] },

  // 8. Ao Ar Livre & Ciclismo
  { id: "ciclismo_estrada", name: "Ciclismo / Bike na Rua", category: "ao_ar_livre", supportsDistance: true, supportsPace: true, supportsIntensity: true, defaultDurationMin: 60, aliases: ["speed", "road bike", "pedal", "bicicleta rua"] },
  { id: "mountain_bike", name: "Mountain Bike (MTB)", category: "ao_ar_livre", supportsDistance: true, supportsIntensity: true, defaultDurationMin: 90, aliases: ["mtb", "trilha bike", "pedal terra"] },
  { id: "trilha_trekking", name: "Trilha / Trekking", category: "ao_ar_livre", supportsDistance: true, supportsIntensity: true, defaultDurationMin: 90, aliases: ["caminhada montanha", "hiking", "trekking"] },
  { id: "escalada", name: "Escalada / Boulder", category: "ao_ar_livre", supportsIntensity: true, defaultDurationMin: 60, aliases: ["climbing", "bouldering", "muro escalada"] },
  { id: "skate", name: "Skate", category: "ao_ar_livre", supportsIntensity: true, defaultDurationMin: 60, aliases: ["skateboard", "longboard", "pista skate"] },
  { id: "patins", name: "Patins / Roller", category: "ao_ar_livre", supportsDistance: true, supportsIntensity: true, defaultDurationMin: 45, aliases: ["roller", "patinacao", "inline"] },
  { id: "patinete", name: "Patinete", category: "ao_ar_livre", supportsDistance: true, defaultDurationMin: 30, aliases: ["scooter"] },

  // 9. Dança
  { id: "danca_ritmos", name: "Ritmos / FitDance", category: "danca", supportsIntensity: true, defaultDurationMin: 50, aliases: ["fitdance", "dance fit", "coreografia"] },
  { id: "zumba", name: "Zumba", category: "danca", supportsIntensity: true, defaultDurationMin: 50, aliases: ["zumbafit"] },
  { id: "danca_salao", name: "Dança de Salão", category: "danca", supportsIntensity: true, defaultDurationMin: 60, aliases: ["forro", "samba de gafieira", "bolero", "salsa", "bachata", "tango"] },
  { id: "ballet_fitness", name: "Ballet / Ballet Fitness", category: "danca", supportsIntensity: true, defaultDurationMin: 60, aliases: ["ballet", "barra de ballet"] },
  { id: "pole_dance", name: "Pole Dance", category: "danca", supportsIntensity: true, defaultDurationMin: 60, aliases: ["pole fitness"] },
  { id: "hip_hop_danca", name: "Hip Hop / Street Dance", category: "danca", supportsIntensity: true, defaultDurationMin: 60, aliases: ["street dance", "breakdance", "danca urbana"] },

  // 10. Corpo & Mente
  { id: "yoga", name: "Yoga", category: "corpo_mente", supportsIntensity: true, defaultDurationMin: 50, aliases: ["vinyasa", "hatha", "ashtanga", "ioga"] },
  { id: "pilates", name: "Pilates (Solo / Studio)", category: "corpo_mente", supportsIntensity: true, defaultDurationMin: 50, aliases: ["reformer", "mat pilates", "cadillac"] },
  { id: "alongamento", name: "Alongamento & Mobilidade", category: "corpo_mente", supportsIntensity: true, defaultDurationMin: 30, aliases: ["stretching", "mobilidade articular", "flexibilidade"] },
  { id: "tai_chi_chuan", name: "Tai Chi Chuan", category: "corpo_mente", supportsIntensity: true, defaultDurationMin: 45, aliases: ["tai chi", "qigong"] },

  // 11. Outros
  { id: "bowling", name: "Boliche", category: "outros", defaultDurationMin: 60, aliases: ["bowling"] },
  { id: "tiro_arco", name: "Tiro com Arco", category: "outros", defaultDurationMin: 60, aliases: ["arco e flecha", "archery"] },
  { id: "ginastica_laboral", name: "Ginástica Laboral", category: "outros", defaultDurationMin: 15, aliases: ["laboral", "alongamento trabalho"] },
  { id: "brincadeiras_ativas", name: "Atividade / Brincadeira com Filhos", category: "outros", supportsIntensity: true, defaultDurationMin: 45, aliases: ["parquinho", "pega pega", "brincadeira"] },
];

/**
 * Normaliza string para busca insensível a acentos, maiúsculas e caracteres especiais.
 */
export function normalizeSearchTerm(str: string): string {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

/**
 * Busca flexível de atividades por nome, categoria ou aliases ("vol" -> Vôlei, "pet" -> Peteca, "hand" -> Handebol, "corr" -> Corrida).
 */
export function searchActivities(term: string, categoryFilter?: ActivityCategory | "all"): ActivityItem[] {
  const normTerm = normalizeSearchTerm(term);

  let filtered = ACTIVITIES_CATALOG;
  if (categoryFilter && categoryFilter !== "all") {
    filtered = filtered.filter((a) => a.category === categoryFilter);
  }

  if (!normTerm) return filtered;

  return filtered.filter((item) => {
    const normName = normalizeSearchTerm(item.name);
    if (normName.includes(normTerm)) return true;

    if (item.aliases?.some((al) => normalizeSearchTerm(al).includes(normTerm))) {
      return true;
    }

    const catDef = ACTIVITY_CATEGORIES.find((c) => c.id === item.category);
    if (catDef && normalizeSearchTerm(catDef.name).includes(normTerm)) {
      return true;
    }

    return false;
  });
}

/**
 * Encontra uma atividade pelo nome (exato ou aproximado) ou retorna item genérico.
 */
export function findActivityByName(name: string): ActivityItem | undefined {
  if (!name) return undefined;
  const norm = normalizeSearchTerm(name);
  return ACTIVITIES_CATALOG.find(
    (a) =>
      normalizeSearchTerm(a.name) === norm ||
      a.aliases?.some((al) => normalizeSearchTerm(al) === norm),
  );
}

/**
 * Calcula pace no formato "MM:SS /km" a partir da duração (minutos) e distância (km).
 */
export function calculatePace(durationMin: number, distanceKm: number): string | null {
  if (!durationMin || !distanceKm || distanceKm <= 0 || durationMin <= 0) {
    return null;
  }
  const totalSecondsPerKm = Math.round((durationMin * 60) / distanceKm);
  const paceMinutes = Math.floor(totalSecondsPerKm / 60);
  const paceSeconds = totalSecondsPerKm % 60;
  return `${paceMinutes}:${paceSeconds.toString().padStart(2, "0")} /km`;
}

/**
 * Helper para obter chave de histórico recente no localStorage
 */
const RECENTS_STORAGE_KEY = "cargaapp_recent_activities_v1";

export function getRecentActivities(): string[] {
  try {
    const raw = localStorage.getItem(RECENTS_STORAGE_KEY);
    if (!raw) return ["Esteira", "Caminhada", "Corrida na Rua", "Bike Indoor / Spinning", "Futebol", "Beach Tennis"];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : ["Esteira", "Caminhada", "Corrida na Rua", "Bike Indoor / Spinning"];
  } catch {
    return ["Esteira", "Caminhada", "Corrida na Rua", "Bike Indoor / Spinning"];
  }
}

export function saveRecentActivity(activityName: string): void {
  try {
    if (!activityName || !activityName.trim()) return;
    const name = activityName.trim();
    const current = getRecentActivities().filter((a) => a.toLowerCase() !== name.toLowerCase());
    const updated = [name, ...current].slice(0, 8);
    localStorage.setItem(RECENTS_STORAGE_KEY, JSON.stringify(updated));
  } catch {
    // Ignore localStorage errors
  }
}
