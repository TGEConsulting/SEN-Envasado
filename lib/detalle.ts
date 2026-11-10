// Detalle por máquina / indicador para un día, con la tendencia de los últimos días.
import { sql } from "./db";
import { loadConfig } from "./config-db";
import { delaySem } from "./capture";
import { computeHourly, type HRow } from "./multivac";
import { MULTIVAC_IDS, MULTIVAC_NAMES, type Config } from "./config";
import { N, dayChip, dayLong, n0, pct, sem, type Sem } from "./domain";
import { BATCH_TAB, loadRaw, ratio, rowsOf, summarizeDay, type DayRaw } from "./tablero";

type Db = ReturnType<typeof sql>;
const sg = (n: number) => (n > 0 ? "+" : "") + n0(n);

export type Kpi = { label: string; val: string; sub: string; bar: string };
export type SparkBar = { lab: string; txt: string; h: number; c: string; cur: boolean };
export type Detalle = {
  kind: "batch" | "multivac" | "ent"; day: string; title: string; sub: string; noData: boolean;
  kpis: Kpi[]; sparkTitle: string; spark: SparkBar[];
  batch?: {
    delays: { n: number; txt: string; h: number; c: string }[];
    rows: { n: number; exp: string; real: string; d: string; pz: string; rend: string; st: Sem }[];
    prog: { id: number; name: string; p: string }[]; progTotal: string;
  };
  multivac?: {
    products: { id: number; label: string; sub: string }[]; product: number;
    sku: { name: string; st: Sem; w: number; mark: number; nums: string; pct: string }[];
    bars: { n: string; txt: string; h: number; c: string }[];
    rows: { lab: string; meta: string; pzs: string; diff: string; rend: string; est: Sem | null; paro: string }[];
  };
  ent?: { rows: { sku: number; name: string; proc: string; p: string; e: string; f: string; pct: string; st: Sem }[] };
};

function spark(days: string[], day: string, vals: (number | null)[]): SparkBar[] {
  return days.map((d, i) => ({ lab: dayChip(d), txt: pct(vals[i]), h: vals[i] == null ? 4 : Math.max(4, Math.round((Math.min(vals[i] as number, 1.3) / 1.3) * 110)), c: sem(vals[i]).c, cur: d === day }));
}
const hRowsOf = (raw: DayRaw, id: number): HRow[] => {
  const rows: HRow[] = Array.from({ length: 15 }, () => ({ fin: "", pzs: "", alm: "", paro: "", bob: "", tcb: "" }));
  for (const h of raw.hourly.filter((x) => Number(x.article_id) === id)) {
    const i = Number(h.hour_idx);
    if (i >= 0 && i < 15) rows[i] = { fin: h.fin ?? "", pzs: h.pieces?.toString() ?? "", alm: h.stored?.toString() ?? "", paro: h.downtime_min?.toString() ?? "", bob: h.reel_changes?.toString() ?? "", tcb: h.reel_change_min?.toString() ?? "" };
  }
  return rows;
};

export async function loadDetalle(db: Db, tab: string, day: string, days: string[], product?: number): Promise<Detalle> {
  const cfg: Config = await loadConfig(db);
  const all = [...new Set([...days, day])].sort().slice(-5);
  const raws = await loadRaw(db, all);
  const sum = Object.fromEntries(all.map((d) => [d, summarizeDay(raws[d], cfg)]));
  const S = sum[day], raw = raws[day];
  const kpi = (label: string, val: string, sub: string, bar = "var(--color-accent)"): Kpi => ({ label, val, sub, bar });

  // ── máquinas por batch ──
  if (BATCH_TAB[tab]) {
    const m = BATCH_TAB[tab], mm = S.machines[m], c = mm.c, tol = cfg.tolerance, rows = rowsOf(raw.batch, m);
    const prog = raw.progs.filter((p) => p.kind === "empaque" && p.process === m && Number(p.qty) > 0)
      .map((p) => ({ id: Number(p.article_id), name: String(p.description).trim(), p: n0(Number(p.qty)) })).sort((a, b) => a.id - b.id);
    return {
      kind: "batch", day, title: m, noData: !mm.hasRows,
      sub: mm.prog.qty ? `${m === "Tecnovac" ? "Pedido" : "Programa"} ${n0(mm.prog.qty)}${c.raw.sPz ? ` · empacado ${n0(c.raw.sPz)}` : ""}` : "Sin programa de empaque",
      kpis: c.kpis, sparkTitle: "Cumplimiento de los últimos días", spark: spark(all, day, all.map((d) => sum[d].machines[m].ratio)),
      batch: {
        delays: c.calc.filter((x) => x.retN != null).map((x) => ({ n: x.n, txt: ((x.retN as number) > 0 ? "+" : "") + Math.round(x.retN as number), h: Math.max(4, Math.round(Math.min(Math.abs(x.retN as number), 100) / 100 * 120)), c: delaySem(x.retN as number, tol).c })),
        rows: c.calc.map((x) => ({ n: x.n, exp: x.exp, real: rows[x.n - 1].real || "—", d: x.retTxt, pz: x.ok ? n0(Number(rows[x.n - 1].pzs)) : "—", rend: x.rend, st: x.retSem ?? N })),
        prog, progTotal: n0(prog.reduce((a, p) => a + Number(p.p.replace(/,/g, "")), 0)),
      },
    };
  }

  // ── Multivac ──
  if (tab === "ter") {
    const sel = product && (MULTIVAC_IDS as readonly number[]).includes(product) ? product : MULTIVAC_IDS.find((id) => (S.progMv[id] ?? 0) > 0) ?? MULTIVAC_IDS[0];
    const h = computeHourly(hRowsOf(raw, sel), cfg.hourly.starts, cfg.hourly.goals[sel]);
    const hr = hRowsOf(raw, sel);
    return {
      kind: "multivac", day, title: "Multivac", noData: S.mvDone.length === 0,
      sub: S.mvProg ? `Programa ${n0(S.mvProg)}${S.mvDone.length ? ` · logrado ${n0(S.mvRealSum)}` : ""}` : "Sin programa de empaque",
      kpis: h.kpis, sparkTitle: "Cumplimiento de los últimos días", spark: spark(all, day, all.map((d) => sum[d].mvRatio)),
      multivac: {
        product: sel,
        products: MULTIVAC_IDS.map((id) => ({ id, label: MULTIVAC_NAMES[id], sub: S.mvReal[id] != null ? pct(ratio(S.mvReal[id] as number, S.progMv[id] ?? 0)) : "Sin captura" })),
        sku: MULTIVAC_IDS.map((id) => { const r = S.mvReal[id] != null ? ratio(S.mvReal[id] as number, S.progMv[id] ?? 0) : null; const p = S.progMv[id] ?? 0;
          return { name: MULTIVAC_NAMES[id], st: sem(r), w: r == null ? 0 : Math.min(r, 1.2) / 1.2, mark: 1 / 1.2, pct: pct(r), nums: S.mvReal[id] != null ? `${n0(S.mvReal[id] as number)} de ${n0(p)}` : `Programa ${n0(p)}` }; }),
        bars: h.calc.map((x, i) => ({ x, i })).filter(({ i }) => hr[i].pzs !== "").map(({ x, i }) => { const r = Number(hr[i].pzs) / (cfg.hourly.goals[sel][i] || 1);
          return { n: x.ini.slice(0, 2), txt: pct(r).replace(".0%", "%"), h: Math.max(4, Math.round((Math.min(r, 1.3) / 1.3) * 130)), c: sem(r).c }; }),
        rows: h.calc.map((x, i) => ({ lab: `${x.ini} – ${hr[i].fin || "…"}`, meta: x.meta, pzs: hr[i].pzs === "" ? "—" : n0(Number(hr[i].pzs)), diff: x.diff, rend: x.rend, est: x.est, paro: hr[i].paro === "" ? "—" : hr[i].paro })),
      },
    };
  }

  // ── Entregas de PT ──
  const arts = await db`select id, description, process from articles`;
  const info = new Map(arts.map((a) => [Number(a.id), a]));
  const ids = [...new Set([...S.progEntById.keys(), ...S.delById.keys()])].filter((id) => (S.progEntById.get(id) ?? 0) > 0 || S.delById.has(id)).sort((a, b) => a - b);
  const e = S.ent;
  return {
    kind: "ent", day, title: "Entregas de PT", noData: !S.hasDeliv,
    sub: S.progEnt ? `Programadas ${n0(S.progEnt)}${S.hasDeliv ? ` · entregadas ${n0(e.tot)}` : ""}` : "Sin programa de entregas",
    kpis: S.hasDeliv ? [kpi("Fill rate", pct(e.fill), "Entregado hasta lo programado", sem(e.fill).c), kpi("Volumen", pct(e.vol), `${n0(e.tot)} de ${n0(S.progEnt)} pzs.`),
      kpi("SKUs completos", `${e.full} de ${e.withProg}`, "Con programa"), kpi("Faltante", n0(e.falt), "pzs."), kpi("Excedente", n0(e.exc), "pzs.")] : [],
    sparkTitle: "Fill rate de los últimos días", spark: spark(all, day, all.map((d) => (sum[d].hasDeliv ? sum[d].ent.fill : null))),
    ent: { rows: ids.map((id) => { const p = S.progEntById.get(id) ?? 0, d = S.delById.get(id) ?? 0, r = p > 0 ? d / p : null, a = info.get(id);
      return { sku: id, name: String(a?.description ?? id).trim(), proc: String(a?.process ?? "—"), p: n0(p), e: S.delById.has(id) ? n0(d) : "—", f: n0(Math.max(p - d, 0)), pct: pct(r), st: S.hasDeliv ? sem(r) : N }; }) },
  };
}
export { sg, dayLong };
