// Configuración editable de la operación. Puro (sin base de datos) para usarlo en cliente y servidor.
export const BATCH_MACHINES = ["Tecnovac", "Embolsado", "Termo MK", "Polar"] as const;
export type BatchMachine = (typeof BATCH_MACHINES)[number];
export const CONFIG_MACHINES = ["Tecnovac", "Multivac", "Termo MK", "Embolsado", "Polar"] as const;
export const N_BATCHES = 13;
export const N_HOURS = 15;
export const MULTIVAC_IDS = [2135, 1065, 1073] as const;
export const MULTIVAC_NAMES: Record<number, string> = { 2135: "Oaxaca 3B 400 g", 1065: "Panela 300 g", 1073: "Ranchero 220 g" };

export type BatchCfg = { times: string[]; metas: (number | null)[]; weightG: number | null };
export type Config = {
  tolerance: number;
  batch: Record<BatchMachine, BatchCfg>;
  hourly: { starts: string[]; goals: Record<number, (number | null)[]> };
};

const hhmm = (m: number) => String(Math.floor(m / 60) % 24).padStart(2, "0") + ":" + String(m % 60).padStart(2, "0");
export const generateTimes = (start: string, every: number, n: number) => {
  const [h, m] = start.split(":").map(Number);
  return Array.from({ length: N_BATCHES }, (_, i) => (i < n ? hhmm(h * 60 + m + i * every) : ""));
};

export function defaultConfig(): Config {
  const b = (w: number | null): BatchCfg => ({ times: generateTimes("09:05", 65, N_BATCHES), metas: Array(N_BATCHES).fill(null), weightG: w });
  return {
    tolerance: 10,
    batch: { Tecnovac: b(250), Embolsado: b(null), "Termo MK": b(null), Polar: b(null) },
    hourly: {
      starts: Array.from({ length: N_HOURS }, (_, i) => String(8 + i).padStart(2, "0") + ":00"),
      goals: Object.fromEntries(MULTIVAC_IDS.map((id) => [id, Array(N_HOURS).fill(900)])),
    },
  };
}

const T = /^([01]\d|2[0-3]):[0-5]\d$/;
const int = (v: unknown, max: number): number | null | undefined => {
  if (v === null || v === "" || v === undefined) return null;
  const n = Number(v);
  return Number.isInteger(n) && n >= 0 && n <= max ? n : undefined; // undefined = inválido
};

// Valida y normaliza una configuración recibida (o guardada). Devuelve el mensaje del primer error.
export function parseConfig(raw: unknown): { ok: true; cfg: Config } | { ok: false; msg: string } {
  const r = raw as Partial<Config> | null;
  if (!r || typeof r !== "object") return { ok: false, msg: "Configuración vacía." };
  const tol = Number(r.tolerance);
  if (!Number.isInteger(tol) || tol < 0 || tol > 20) return { ok: false, msg: "La tolerancia debe ser un entero de 0 a 20 minutos (después de 20 es rojo)." };
  const cfg = defaultConfig(); cfg.tolerance = tol;
  for (const m of BATCH_MACHINES) {
    const x = r.batch?.[m];
    if (!x || x.times?.length !== N_BATCHES || x.metas?.length !== N_BATCHES) return { ok: false, msg: `${m}: faltan batches.` };
    const times = x.times.map((t) => String(t ?? "").trim());
    for (let i = 0; i < N_BATCHES; i++) if (times[i] !== "" && !T.test(times[i])) return { ok: false, msg: `${m}: la hora del batch ${i + 1} no es válida.` };
    const set = times.filter(Boolean);
    if (new Set(set).size !== set.length) return { ok: false, msg: `${m}: hay horas esperadas repetidas.` };
    const metas = x.metas.map((v) => int(v, 10_000_000));
    if (metas.some((v) => v === undefined)) return { ok: false, msg: `${m}: una meta de piezas no es válida.` };
    const w = int(x.weightG, 5000);
    if (w === undefined) return { ok: false, msg: `${m}: el peso objetivo no es válido (gramos enteros).` };
    cfg.batch[m] = { times, metas: metas as (number | null)[], weightG: w };
  }
  const starts = r.hourly?.starts;
  if (!starts || starts.length !== N_HOURS || starts.some((t) => !T.test(String(t)))) return { ok: false, msg: "Multivac: las horas de inicio no son válidas." };
  cfg.hourly.starts = starts.map(String);
  for (const id of MULTIVAC_IDS) {
    const g = r.hourly?.goals?.[id];
    if (!g || g.length !== N_HOURS) return { ok: false, msg: `Multivac: faltan franjas de ${MULTIVAC_NAMES[id]}.` };
    const v = g.map((n) => int(n, 10_000_000));
    if (v.some((n) => n === undefined)) return { ok: false, msg: `Multivac: una meta de ${MULTIVAC_NAMES[id]} no es válida.` };
    cfg.hourly.goals[id] = v as (number | null)[];
  }
  return { ok: true, cfg };
}

export type CfgChange = { program: string; old: string; nw: string };
const s = (v: unknown) => (v === null || v === "" || v === undefined ? "—" : String(v));

// Cambios campo por campo, para la bitácora.
export function diffConfig(a: Config, b: Config): CfgChange[] {
  const out: CfgChange[] = [];
  const add = (program: string, o: unknown, n: unknown) => { if (s(o) !== s(n)) out.push({ program, old: s(o), nw: s(n) }); };
  add("Configuración · Tolerancia a tiempo (min)", a.tolerance, b.tolerance);
  for (const m of BATCH_MACHINES) {
    add(`Configuración · ${m} · Peso objetivo (g)`, a.batch[m].weightG, b.batch[m].weightG);
    for (let i = 0; i < N_BATCHES; i++) {
      add(`Configuración · ${m} · Hora esperada batch ${i + 1}`, a.batch[m].times[i], b.batch[m].times[i]);
      add(`Configuración · ${m} · Meta batch ${i + 1}`, a.batch[m].metas[i], b.batch[m].metas[i]);
    }
  }
  for (let i = 0; i < N_HOURS; i++) add(`Configuración · Multivac · Hora de inicio franja ${i + 1}`, a.hourly.starts[i], b.hourly.starts[i]);
  for (const id of MULTIVAC_IDS) for (let i = 0; i < N_HOURS; i++)
    add(`Configuración · Multivac · Meta ${MULTIVAC_NAMES[id]} franja ${i + 1}`, a.hourly.goals[id][i], b.hourly.goals[id][i]);
  return out;
}
