// Captura por batch: constantes y cálculos (puros, compartidos por cliente y servidor).
import { A, G, N, R, n0, pct, sem, type Sem } from "./domain";
import { BATCH_MACHINES, N_BATCHES, generateTimes, type BatchCfg } from "./config";
export { BATCH_MACHINES, N_BATCHES };

export const CAPTURE_MACHINES = ["Multivac", ...BATCH_MACHINES] as const;

export const DEFAULT_TIMES = generateTimes("09:05", 65, N_BATCHES);
export const hasDowntime = (m: string) => m !== "Embolsado";

export type Row = { real: string; paro: string; kg: string; peso: string; pzs: string; mer: string };
export const emptyRow = (): Row => ({ real: "", paro: "", kg: "", peso: "", pzs: "", mer: "" });
export const emptyRows = () => Array.from({ length: N_BATCHES }, emptyRow);

export function hhmm(m: number) {
  return String(Math.floor(m / 60) % 24).padStart(2, "0") + ":" + String(Math.round(m % 60)).padStart(2, "0");
}
const mins = (t: string) => { const [h, m] = t.split(":"); return h !== "" && h != null && m != null && isFinite(+h) && isFinite(+m) ? +h * 60 + +m : NaN; };
const num = (x: string) => { const v = parseFloat(x); return isFinite(v) ? v : NaN; };
const fx = (v: number, d: number) => (isFinite(v) ? v.toFixed(d) : "—");
const sg = (n: number) => (n > 0 ? "+" : "") + n0(n);

// Verde dentro de la tolerancia, amarillo hasta 20 min, rojo después.
export const delaySem = (min: number, tol: number): Sem => (min <= tol ? G : min <= 20 ? A : R);

export type Calc = {
  n: number; retN: number | null; exp: string; meta: string; dm: string; retTxt: string; retSem: Sem | null; tot: string; tm: string;
  rend: string; rendWarn: boolean; des: string; pdes: string; ok: boolean;
};
export type Kpi = { label: string; val: string; sub: string; bar: string };
export type Warn = { s: Sem; h: string; m: string };

export type CaptureCfg = BatchCfg & { tolerance: number };

export function compute(machine: string, rows: Row[], cfg: CaptureCfg) {
  const times = cfg.times, tol = cfg.tolerance, tg = (cfg.weightG ?? 0) / 1000;
  const items = rows.map((r, i) => {
    const exp = mins(times[i] ?? ""), rm = mins(r.real);
    const kg = num(r.kg), peso = num(r.peso), pzs = num(r.pzs), mer = num(r.mer) || 0, paro = num(r.paro) || 0;
    const ok = [kg, peso, pzs].every((v) => isFinite(v) && v > 0);
    const prod = ok ? peso * pzs : NaN, tm = prod + mer;
    const meta = cfg.metas[i] ?? NaN;
    return { i, exp, rm, kg, meta, peso, pzs, mer, paro, ok, prod, tm, rend: tm / kg, des: ok ? Math.max(0, kg - tm) : NaN,
      ret: rm - exp, has: ok || isFinite(rm) || [r.kg, r.peso, r.pzs].some((v) => v !== "") };
  }).filter((c) => isFinite(c.exp));

  const calc: Calc[] = items.map((c) => ({
    n: c.i + 1, retN: isFinite(c.ret) ? c.ret : null, exp: hhmm(c.exp), ok: c.ok,
    meta: isFinite(c.meta) && c.meta > 0 ? n0(c.meta) : "—", dm: c.ok && isFinite(c.meta) && c.meta > 0 ? sg(c.pzs - c.meta) : "—",
    retTxt: isFinite(c.ret) ? (c.ret > 0 ? "+" : "") + Math.round(c.ret) + " min" : "—",
    retSem: isFinite(c.ret) ? delaySem(c.ret, tol) : null,
    tot: fx(c.prod, 2), tm: fx(c.tm, 2),
    rend: c.ok ? pct(c.rend) : "—", rendWarn: c.ok && (c.rend > 1.1 || c.rend < 0.9),
    des: fx(c.des, 2), pdes: c.ok ? pct(c.des / c.kg) : "—",
  }));

  const done = items.filter((c) => c.ok);
  const sum = (f: (c: (typeof items)[number]) => number) => done.reduce((a, c) => a + (f(c) || 0), 0);
  const sKg = sum((c) => c.kg), sPz = sum((c) => c.pzs), sProd = sum((c) => c.prod), sMer = sum((c) => c.mer);
  const sTm = sum((c) => c.tm), sDes = sum((c) => c.des), sPar = items.reduce((a, c) => a + c.paro, 0);
  const dmm = done.filter((c) => isFinite(c.meta) && c.meta > 0);
  const sMt = dmm.reduce((a, c) => a + c.meta, 0), sMp = dmm.reduce((a, c) => a + c.pzs, 0);
  const acc = {
    meta: sMt ? n0(sMt) : "—", dm: sMt ? sg(sMp - sMt) : "—",
    paro: sPar + " min", pzs: n0(sPz), tot: sProd.toFixed(2), mer: sMer.toFixed(2), tm: sTm.toFixed(2),
    rend: sKg ? pct(sTm / sKg) : "—", des: sDes.toFixed(2), pdes: sKg ? pct(sDes / sKg) : "—",
  };

  const wr = items.filter((c) => isFinite(c.ret)), onT = wr.filter((c) => c.ret <= tol).length;
  const avgPeso = done.length ? done.reduce((a, c) => a + c.peso, 0) / done.length : NaN;
  const acc2 = "var(--color-accent)";
  const kpis: Kpi[] = [
    ...(hasDowntime(machine) ? [{ label: "Paro por MTO.", val: sPar + " min", sub: sPar ? "Acumulado de la jornada" : "Sin paros registrados", bar: sPar > 60 ? A.c : acc2 }] : []),
    { label: "Cumplimiento de meta", val: sMt ? pct(sMp / sMt) : "—", sub: sMt ? `${n0(sMp)} de ${n0(sMt)} pzs.` : "Sin meta configurada", bar: sMt ? sem(sMp / sMt).c : acc2 },
    { label: "Batches a tiempo", val: wr.length ? pct(onT / wr.length) : "—", sub: wr.length ? `${onT} de ${wr.length}` : "Sin captura", bar: acc2 },
    { label: "Rendimiento", val: sKg ? pct(sTm / sKg) : "—", sub: sKg ? n0(sKg) + " kg fundidos" : "Sin captura", bar: acc2 },
    { label: "Desecho", val: sKg ? pct(sDes / sKg) : "—", sub: sKg ? sDes.toFixed(1) + " kg" : "Sin captura", bar: acc2 },
    { label: "Sobrepeso vs " + (tg ? Math.round(tg * 1000) + " g" : "meta"),
      val: isFinite(avgPeso) && tg ? "+" + ((avgPeso / tg - 1) * 100).toFixed(1) + "%" : "—",
      sub: tg ? (isFinite(avgPeso) ? (avgPeso * 1000).toFixed(0) + " g por pieza" : "Sin captura") : "Sin peso objetivo", bar: acc2 },
  ];

  const w: Warn[] = [];
  items.forEach((c) => {
    const b = `Batch ${c.i + 1}:`;
    if (c.has && !c.ok) w.push({ s: R, h: b, m: "faltan kg fundidos, peso o piezas." });
    if (c.ok && !isFinite(c.rm)) w.push({ s: A, h: b, m: "sin hora real de término." });
    if (isFinite(c.ret) && c.ret > 60) w.push({ s: A, h: b, m: `la hora real es ${Math.round(c.ret)} min posterior a la esperada (${hhmm(c.exp)}). Verifica la hora.` });
    if (c.ok && (c.rend > 1.1 || c.rend < 0.9)) w.push({ s: A, h: b, m: `rendimiento ${pct(c.rend)} fuera de 90–110%.` });
    if (c.ok && tg && (c.peso < tg * 0.98 || c.peso > tg * 1.08)) w.push({ s: A, h: b, m: `peso por pieza atípico (${c.peso} kg; objetivo ${tg} kg).` });
  });
  const warns: Warn[] = w.length
    ? w.slice(0, 5).concat(w.length > 5 ? [{ s: N, h: `Y ${w.length - 5} observaciones más.`, m: "" }] : [])
    : [{ s: G, h: "Sin observaciones.", m: "Los valores están dentro de los rangos esperados." }];

  const raw = { sPz, sKg, sTm, sDes, sPar, sMer, nTimed: wr.length, onT, avgPeso, tg, sMt, sMp };
  return { calc, acc, kpis, warns, hasErrors: w.some((x) => x.s === R), raw };
}
export { sg };
