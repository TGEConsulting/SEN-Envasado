// Cálculo del día con los datos reales de Neon (programas, captura por batch/hora, entregas).
// `summarizeDay` es la única fuente de números: la usan el tablero y el detalle por máquina.
import { sql } from "./db";
import { loadConfig } from "./config-db";
import { compute, emptyRows, type Row } from "./capture";
import { MULTIVAC_IDS, MULTIVAC_NAMES, type Config } from "./config";
import { N, n0, pct, sem, type Sem } from "./domain";
import { monthRange, weekRange } from "./calendario";
import { loadPeriodo } from "./periodo-db";

type Db = ReturnType<typeof sql>;
type R = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
export type TabId = "ent" | "ter" | "mol" | "mk" | "embo" | "vac";
export type CardData = { title: string; big: string; bigLabel: string; st: Sem; tab: TabId | null; lines: { a: string; b: string }[]; foot: string };
export type TableroData = { day: string; days: string[]; headline: string; cards: CardData[]; month: { a: string; b: string }[] };
export type DayRaw = { progs: R[]; batch: R[]; hourly: R[]; deliv: R[]; packed: R[]; pesaje: Record<number, number> };

export const BATCH_TAB: Record<string, "Tecnovac" | "Termo MK" | "Embolsado" | "Polar"> = { mol: "Tecnovac", mk: "Termo MK", embo: "Embolsado", vac: "Polar" };
const MAQ = [{ name: "Termo MK", tab: "mk" }, { name: "Embolsado", tab: "embo" }, { name: "Polar", tab: "vac" }] as const;
// Todos los días del mes desde el 1 hasta `day` (inclusive).
export const monthDays = (day: string): string[] => {
  const [y, m, d] = day.split("-").map(Number);
  return Array.from({ length: d }, (_, i) => `${y}-${String(m).padStart(2, "0")}-${String(i + 1).padStart(2, "0")}`);
};
export const ratio = (a: number, b: number) => (b > 0 ? a / b : null);

export async function recentDays(db: Db): Promise<string[]> {
  const r = await db`select to_char(day,'YYYY-MM-DD') as d from (
      select day from programs union select day from batch_records union select day from hourly_records union select day from deliveries) t
    order by day desc limit 5`;
  return r.map((x) => x.d as string).reverse();
}

// Datos crudos de varios días en 4 consultas.
export async function loadRaw(db: Db, days: string[]): Promise<Record<string, DayRaw>> {
  const [progs, batch, hourly, deliv, packed, arts] = await Promise.all([
    db`select to_char(p.day,'YYYY-MM-DD') as d, p.kind, p.article_id, a.description, a.process, p.qty from programs p join articles a on a.id = p.article_id where p.day = any(${days}::date[])`,
    db`select to_char(day,'YYYY-MM-DD') as d, machine, batch_no, to_char(real_time,'HH24:MI') as real, downtime_min, kg_melted, piece_kg, pieces, merma_kg from batch_records where day = any(${days}::date[])`,
    db`select to_char(day,'YYYY-MM-DD') as d, article_id, hour_idx, to_char(end_time,'HH24:MI') as fin, pieces, stored, downtime_min, reel_changes, reel_change_min from hourly_records where day = any(${days}::date[])`,
    db`select to_char(day,'YYYY-MM-DD') as d, article_id, qty from deliveries where day = any(${days}::date[])`,
    db`select to_char(k.day,'YYYY-MM-DD') as d, k.article_id, a.process, k.qty from packed k join articles a on a.id = k.article_id where k.day = any(${days}::date[])`,
    db`select id, pesaje from articles where pesaje is not null`,
  ]);
  const pesaje: Record<number, number> = Object.fromEntries(arts.map((a) => [Number(a.id), Number(a.pesaje)]));
  const out: Record<string, DayRaw> = Object.fromEntries(days.map((d) => [d, { progs: [], batch: [], hourly: [], deliv: [], packed: [], pesaje }]));
  for (const r of progs) out[r.d]?.progs.push(r);
  for (const r of batch) out[r.d]?.batch.push(r);
  for (const r of hourly) out[r.d]?.hourly.push(r);
  for (const r of deliv) out[r.d]?.deliv.push(r);
  for (const r of packed) out[r.d]?.packed.push(r);
  return out;
}

export const rowsOf = (batch: R[], machine: string): Row[] => {
  const rows = emptyRows();
  for (const r of batch.filter((b) => b.machine === machine)) {
    const i = Number(r.batch_no) - 1;
    if (i >= 0 && i < rows.length) rows[i] = { real: r.real ?? "", paro: r.downtime_min?.toString() ?? "", kg: r.kg_melted?.toString() ?? "", peso: r.piece_kg?.toString() ?? "", pzs: r.pieces?.toString() ?? "", mer: r.merma_kg?.toString() ?? "" };
  }
  return rows;
};

export function summarizeDay(raw: DayRaw, cfg: Config) {
  const { progs, batch, hourly, deliv, packed, pesaje } = raw;
  const kgOf = (id: number, q: number) => q * (pesaje[id] ?? 0);
  // programas
  const progByProc: Record<string, { qty: number; n: number }> = {};
  const progMv: Record<number, number> = {};
  const progEntById = new Map<number, number>();
  let progEnt = 0;
  for (const r of progs) {
    const q = Number(r.qty);
    if (r.kind === "empaque") {
      const p = (progByProc[r.process] ??= { qty: 0, n: 0 }); p.qty += q; if (q > 0) p.n++;
      if (r.process === "Multivac") progMv[Number(r.article_id)] = q;
    } else { progEnt += q; progEntById.set(Number(r.article_id), q); }
  }
  // entregas
  const delById = new Map(deliv.map((r) => [Number(r.article_id), Number(r.qty)]));
  let entTot = 0, entCapped = 0, entFalt = 0, entExc = 0, entFull = 0, entWithProg = 0;
  for (const id of new Set([...progEntById.keys(), ...delById.keys()])) {
    const p = progEntById.get(id) ?? 0, d = delById.get(id) ?? 0;
    entTot += d; entCapped += Math.min(d, p); entFalt += Math.max(p - d, 0); entExc += Math.max(d - p, 0);
    if (p > 0) { entWithProg++; if (d >= p) entFull++; }
  }
  const hasDeliv = deliv.length > 0;
  // Real de empaque por artículo (TOTAL EMPAQUE del libro)
  const packedById = new Map(packed.map((r) => [Number(r.article_id), Number(r.qty)]));
  const packedByProc: Record<string, number> = {};
  for (const r of packed) packedByProc[r.process] = (packedByProc[r.process] ?? 0) + Number(r.qty);
  const progE = Object.values(progByProc).reduce((a, p) => a + p.qty, 0);
  const realE = packed.reduce((a, r) => a + Number(r.qty), 0);
  const kgE = packed.reduce((a, r) => a + kgOf(Number(r.article_id), Number(r.qty)), 0);
  const kgG = deliv.reduce((a, r) => a + kgOf(Number(r.article_id), Number(r.qty)), 0);
  const hasPacked = packed.length > 0;
  // Multivac: el real por artículo manda; si no hay, se usa la captura por hora
  const mvReal: Record<number, number | null> = {};
  for (const id of MULTIVAC_IDS) {
    const rows = hourly.filter((h) => Number(h.article_id) === id);
    mvReal[id] = packedById.has(id) ? (packedById.get(id) as number) : rows.some((h) => h.pieces != null) ? rows.reduce((a, h) => a + (Number(h.pieces) || 0), 0) : null;
  }
  const mvProg = MULTIVAC_IDS.reduce((a, id) => a + (progMv[id] ?? 0), 0);
  const mvDone = MULTIVAC_IDS.filter((id) => mvReal[id] != null);
  const mvRealSum = mvDone.reduce((a, id) => a + (mvReal[id] as number), 0);
  // Solo se compara contra el programa de los productos ya capturados.
  const mvRatio = mvDone.length ? ratio(mvRealSum, mvDone.reduce((a, id) => a + (progMv[id] ?? 0), 0)) : null;
  // máquinas por batch
  const machines = {} as Record<"Tecnovac" | "Termo MK" | "Embolsado" | "Polar", { c: ReturnType<typeof compute>; prog: { qty: number; n: number }; real: number | null; ratio: number | null; hasRows: boolean }>;
  for (const m of ["Tecnovac", "Termo MK", "Embolsado", "Polar"] as const) {
    const c = compute(m, rowsOf(batch, m), { ...cfg.batch[m], tolerance: cfg.tolerance });
    const prog = progByProc[m] ?? { qty: 0, n: 0 };
    const real = packedByProc[m] ?? (c.raw.sPz > 0 ? c.raw.sPz : null);
    machines[m] = { c, prog, real, ratio: real != null ? ratio(real, prog.qty) : null, hasRows: batch.some((b) => b.machine === m) };
  }
  return {
    progByProc, progMv, progEnt, progEntById, delById, hasDeliv, progE, realE, kgE, kgG, hasPacked, cumplE: hasPacked ? ratio(realE, progE) : null,
    ent: { tot: entTot, capped: entCapped, falt: entFalt, exc: entExc, full: entFull, withProg: entWithProg, fill: ratio(entCapped, progEnt), vol: ratio(entTot, progEnt) },
    mvReal, mvProg, mvDone, mvRealSum, mvRatio, machines,
  };
}

export async function loadTablero(db: Db, day: string, days: string[]): Promise<TableroData> {
  const cfg = await loadConfig(db);
  const S = summarizeDay((await loadRaw(db, [day]))[day], cfg);
  const card = (c: Omit<CardData, "st">, r: number | null): CardData => ({ ...c, st: r == null ? N : sem(r) });

  // Indicadores base del libro: real ÷ programa (ponderado), kilos = piezas × pesaje.
  const emp = card({ title: "Empaque", big: pct(S.cumplE), bigLabel: "Cumplimiento", tab: null,
    lines: S.hasPacked ? [{ a: "Programa", b: n0(S.progE) + " pzs." }, { a: "Real", b: n0(S.realE) + " pzs." }, { a: "Kilos", b: n0(S.kgE) + " kg" }] : [{ a: "Sin real de empaque capturado", b: "" }],
    foot: S.hasPacked ? "Todas las máquinas · real ÷ programa" : S.progE ? `Programa ${n0(S.progE)} pzs.` : "" }, S.cumplE);
  const ent = card({ title: "Entregas CR100", big: S.hasDeliv ? pct(S.ent.vol) : "—", bigLabel: "Cumplimiento", tab: "ent",
    lines: S.hasDeliv ? [{ a: "Programa", b: n0(S.progEnt) + " pzs." }, { a: "Real", b: n0(S.ent.tot) + " pzs." }, { a: "Kilos", b: n0(S.kgG) + " kg" },
      { a: "SKUs completos", b: `${S.ent.full} de ${S.ent.withProg}` }, { a: "Faltante · excedente", b: `${n0(S.ent.falt)} · ${n0(S.ent.exc)}` }] : [{ a: "Sin registro de entregas", b: "" }],
    foot: S.hasDeliv ? "Real ÷ programa, todas las máquinas" : S.progEnt ? `Programa ${n0(S.progEnt)} pzs.` : "" }, S.hasDeliv ? S.ent.vol : null);

  const mv = card({ title: "Multivac", big: pct(S.mvRatio), bigLabel: "Cumplimiento", tab: "ter",
    lines: MULTIVAC_IDS.map((id) => ({ a: MULTIVAC_NAMES[id], b: S.mvReal[id] != null ? pct(ratio(S.mvReal[id] as number, S.progMv[id] ?? 0)) : "Sin captura" })),
    foot: S.mvProg ? `Programa ${n0(S.mvProg)}${S.mvDone.length ? ` · real ${n0(S.mvRealSum)}` : ""}` : "Sin programa de empaque" }, S.mvRatio);

  const machine = (name: "Tecnovac" | "Termo MK" | "Embolsado" | "Polar", tab: TabId): CardData => {
    const m = S.machines[name], x = m.c.raw;
    const lines: CardData["lines"] = [{ a: name === "Tecnovac" ? "Pedido" : "Programa", b: n0(m.prog.qty) + " pzs." }, { a: "Real", b: m.real != null ? n0(m.real) + " pzs." : "Sin captura" }];
    if (m.hasRows && x.sKg > 0) lines.push({ a: "Batches a tiempo", b: x.nTimed ? `${pct(x.onT / x.nTimed)} (${x.onT} de ${x.nTimed})` : "—" }, { a: "Rendimiento", b: pct(x.sTm / x.sKg) }, { a: "Desecho", b: pct(x.sDes / x.sKg) });
    if (m.hasRows && x.tg && isFinite(x.avgPeso)) lines.push({ a: `Sobrepeso vs ${Math.round(x.tg * 1000)} g`, b: "+" + ((x.avgPeso / x.tg - 1) * 100).toFixed(1) + "%" });
    return card({ title: name, big: pct(m.ratio), bigLabel: "Cumplimiento", tab, lines, foot: m.prog.qty ? "" : "Sin programa de empaque" }, m.ratio);
  };
  const cards = [emp, ent, mv, machine("Tecnovac", "mol"), machine("Termo MK", "mk"), machine("Embolsado", "embo"), machine("Polar", "vac")];

  const part = (name: string, v: number | null) => (v == null ? `${name} sin captura` : `${name} ${pct(v)}`);
  const headline = [part("Empaque", S.cumplE), part("Entregas", S.hasDeliv ? S.ent.vol : null), part("Multivac", S.mvRatio)].join(" · ");
  return { day, days, headline, cards, month: await acumulados(db, day) };
}

// Acumulados al corte: semana (WTD) y mes (MTD), ponderados (real acumulado ÷ programa acumulado).
async function acumulados(db: Db, day: string): Promise<{ a: string; b: string }[]> {
  const wk = weekRange(day), mo = monthRange(day);
  const [w, m] = await Promise.all([loadPeriodo(db, wk.from, wk.to, day < wk.to ? day : wk.to), loadPeriodo(db, mo.from, mo.to, day)]);
  const fmt = (r: number | null, real: number, prog: number) => (prog > 0 && r != null ? `${pct(r)} · ${n0(real)} de ${n0(prog)}` : "—");
  const t = (p: typeof w.periodo) => p.total;
  return [
    { a: `Semana ${wk.label} · empaque`, b: fmt(t(w.periodo).cumplE, t(w.periodo).realE, t(w.periodo).progE) },
    { a: `Semana ${wk.label} · entregas`, b: fmt(t(w.periodo).cumplG, t(w.periodo).realG, t(w.periodo).progG) },
    { a: "Mes · empaque", b: fmt(t(m.periodo).cumplE, t(m.periodo).realE, t(m.periodo).progE) },
    { a: "Mes · entregas", b: fmt(t(m.periodo).cumplG, t(m.periodo).realG, t(m.periodo).progG) },
  ];
}
