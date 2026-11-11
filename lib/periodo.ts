// Indicadores del libro (puro, sin base de datos): día, WTD/MTD ponderados y Pareto 80/20.
import { addDays, dayName, eachDay, isOperating } from "./calendario";

export type ArticleMeta = { id: number; description: string; pesaje: number | null; formula: string | null; short: string | null };
export type ArtDay = { progE: number; progG: number; realE: number | null; realG: number | null; inv: number | null };
export type DayData = { articles: Record<number, ArtDay>; hasData: boolean };
export type State = "Con captura" | "Sin captura" | "Fuera de corte" | "No operativo";

export const ratio = (a: number, b: number): number | null => (b > 0 ? a / b : null);
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

export type DayRow = {
  date: string; day: string; state: State;
  progE: number | null; realE: number | null; cumplE: number | null; progG: number | null; realG: number | null; cumplG: number | null; kgE: number | null; kgG: number | null;
};
export type ArtRow = {
  id: number; description: string; short: string; pesaje: number | null; formula: string | null;
  progE: number; progG: number; realE: number; realG: number; kgE: number; kgG: number; cumplE: number | null; cumplG: number | null; inv: number | null;
};
export type Periodo = {
  from: string; to: string; corte: string; rows: DayRow[]; con: number; operativos: number;
  total: { progE: number; realE: number; cumplE: number | null; progG: number; realG: number; cumplG: number | null; kgE: number; kgG: number; inv: number };
  articles: ArtRow[];
};

export function dayState(date: string, corte: string, d: DayData | undefined): State {
  if (!isOperating(date)) return "No operativo";
  if (date > corte) return "Fuera de corte";
  return d?.hasData ? "Con captura" : "Sin captura";
}

// Resumen del periodo: solo cuentan los días «Con captura» (igual que el libro).
export function summarizePeriod(from: string, to: string, corte: string, catalog: ArticleMeta[], days: Record<string, DayData>): Periodo {
  const meta = new Map(catalog.map((a) => [a.id, a]));
  const kg = (id: number, pcs: number) => pcs * (meta.get(id)?.pesaje ?? 0);
  const rows: DayRow[] = [], arts = new Map<number, ArtRow>();
  const invLast = new Map<number, number>();
  for (const a of catalog) arts.set(a.id, { id: a.id, description: a.description, short: a.short ?? a.description, pesaje: a.pesaje, formula: a.formula, progE: 0, progG: 0, realE: 0, realG: 0, kgE: 0, kgG: 0, cumplE: null, cumplG: null, inv: null });
  for (const date of eachDay(from, to)) {
    const d = days[date], state = dayState(date, corte, d);
    const base = { date, day: dayName(date), state };
    if (state !== "Con captura") { rows.push({ ...base, progE: null, realE: null, cumplE: null, progG: null, realG: null, cumplG: null, kgE: null, kgG: null }); continue; }
    let pE = 0, rE = 0, pG = 0, rG = 0, kE = 0, kG = 0;
    for (const [k, v] of Object.entries(d.articles)) {
      const id = Number(k), a = arts.get(id); if (!a) continue;
      const re = v.realE ?? 0, rg = v.realG ?? 0;
      pE += v.progE; rE += re; pG += v.progG; rG += rg; kE += kg(id, re); kG += kg(id, rg);
      a.progE += v.progE; a.progG += v.progG; a.realE += re; a.realG += rg; a.kgE += kg(id, re); a.kgG += kg(id, rg);
      if (v.inv != null && date <= corte) invLast.set(id, v.inv);
    }
    rows.push({ ...base, progE: pE, realE: rE, cumplE: ratio(rE, pE), progG: pG, realG: rG, cumplG: ratio(rG, pG), kgE: kE, kgG: kG });
  }
  const articles = catalog.map((a) => { const r = arts.get(a.id)!; r.cumplE = ratio(r.realE, r.progE); r.cumplG = ratio(r.realG, r.progG); r.inv = invLast.get(a.id) ?? null; return r; });
  const con = rows.filter((r) => r.state === "Con captura");
  const t = { progE: sum(con.map((r) => r.progE!)), realE: sum(con.map((r) => r.realE!)), progG: sum(con.map((r) => r.progG!)), realG: sum(con.map((r) => r.realG!)), kgE: sum(con.map((r) => r.kgE!)), kgG: sum(con.map((r) => r.kgG!)) };
  return {
    from, to, corte, rows, con: con.length, operativos: rows.filter((r) => r.state !== "No operativo").length,
    total: { ...t, cumplE: ratio(t.realE, t.progE), cumplG: ratio(t.realG, t.progG), inv: sum([...invLast.values()]) },
    articles,
  };
}

export type ParetoItem = { id: number; description: string; short: string; value: number; pct: number; cum: number; tramo: "Hasta 80%" | "Resto" | "Sin entregas" };
export type ParetoData = { total: number; n80: number; cum80: number; pctCatalogo: number; topN: number; topShare: number; items: ParetoItem[] };

// Pareto 80/20 sobre todo el catálogo (incluye artículos sin entregas).
export function pareto(list: { id: number; description: string; short: string; value: number }[]): ParetoData {
  const total = sum(list.map((x) => x.value));
  const sorted = [...list].sort((a, b) => b.value - a.value);
  let cum = 0, reached = false, n80 = 0, cum80 = 0;
  const items = sorted.map((x, i): ParetoItem => {
    cum += total > 0 ? x.value / total : 0;
    let tramo: ParetoItem["tramo"];
    if (x.value <= 0) tramo = "Sin entregas";
    else if (!reached) { tramo = "Hasta 80%"; if (cum >= 0.8 - 1e-9) { reached = true; n80 = i + 1; cum80 = cum; } }
    else tramo = "Resto";
    return { ...x, pct: total > 0 ? x.value / total : 0, cum, tramo };
  });
  const topN = Math.ceil(list.length * 0.2);
  return { total, n80, cum80, pctCatalogo: list.length ? n80 / list.length : 0, topN, topShare: total > 0 ? sum(sorted.slice(0, topN).map((x) => x.value)) / total : 0, items };
}
export { addDays };
