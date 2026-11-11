// Multivac: captura por hora (08:00–23:00) y por producto.
import { A, G, N, R, n0, pct, sem, type Sem } from "./domain";

export const HOURLY_PRODUCTS: [number, string][] = [[2135, "Oaxaca 3B 400 g"], [1065, "Panela 300 g"], [1073, "Ranchero 220 g"]];
import { N_HOURS } from "./config";
export const HOUR_STARTS = Array.from({ length: N_HOURS }, (_, i) => String(8 + i).padStart(2, "0") + ":00"); // por defecto; la vigente sale de Configuración

export type HRow = { fin: string; pzs: string; alm: string; paro: string; bob: string; tcb: string };
export const emptyHRow = (): HRow => ({ fin: "", pzs: "", alm: "", paro: "", bob: "", tcb: "" });
export const emptyHRows = () => HOUR_STARTS.map(emptyHRow);
export const emptyProducts = () => Object.fromEntries(HOURLY_PRODUCTS.map(([id]) => [id, emptyHRows()])) as Record<number, HRow[]>;

const num = (x: string) => { const v = parseFloat(x); return isFinite(v) ? v : NaN; };
const mins = (t: string) => { const [h, m] = t.split(":"); return h && m != null && isFinite(+h) && isFinite(+m) ? +h * 60 + +m : NaN; };
const sg = (n: number) => (n > 0 ? "+" : "") + n0(n);
// Duración de la franja: inicio→hora final; sin hora final válida se asume 60 min.
const dur = (a: string, b: string) => { const d = mins(b) - mins(a); return isFinite(d) && d > 0 ? d : 60; };

export type HCalc = { ini: string; meta: string; diff: string; rend: string; est: Sem | null; trab: string };
export type HKpi = { label: string; val: string; sub: string; bar: string };

export function computeHourly(rows: HRow[], starts: string[], goals: (number | null)[]) {
  const items = rows.map((r, i) => {
    const goal = goals[i] ?? 0, ini0 = starts[i] ?? HOUR_STARTS[i];
    const pzs = num(r.pzs), alm = num(r.alm), paro = num(r.paro) || 0, bob = num(r.bob) || 0, tcb = num(r.tcb) || 0;
    const has = isFinite(pzs), rend = has && goal > 0 ? pzs / goal : null;
    const trab = has || paro || tcb ? dur(ini0, r.fin) - paro - tcb : NaN;
    return { i, goal, ini: ini0, fin: r.fin, lab: `${ini0} – ${r.fin || "…"}`, pzs, alm, paro, bob, tcb, has, rend, trab };
  });
  const calc: HCalc[] = items.map((c) => ({
    ini: c.ini, meta: c.goal > 0 ? n0(c.goal) : "—", diff: c.has && c.goal > 0 ? sg(c.pzs - c.goal) : "—", rend: pct(c.rend),
    est: c.has ? sem(c.rend) : null, trab: isFinite(c.trab) ? c.trab + " min" : "—",
  }));
  const dn = items.filter((c) => c.has);
  const sM = dn.reduce((a, c) => a + c.goal, 0), sP = dn.reduce((a, c) => a + c.pzs, 0), sA = dn.reduce((a, c) => a + (c.alm || 0), 0);
  const sPar = items.reduce((a, c) => a + c.paro, 0), sB = items.reduce((a, c) => a + c.bob, 0);
  const sTcb = items.reduce((a, c) => a + c.tcb, 0), sT = items.reduce((a, c) => a + (isFinite(c.trab) ? c.trab : 0), 0);
  const R1 = sM ? sP / sM : null;
  const acc = { meta: n0(sM), pzs: n0(sP), diff: dn.length ? sg(sP - sM) : "—", rend: pct(R1), alm: n0(sA),
    paro: sPar + " min", bob: String(sB), tcb: sTcb + " min", trab: sT + " min" };
  const base = "var(--color-accent)";
  const kpis: HKpi[] = [
    { label: "Rendimiento", val: pct(R1), sub: dn.length ? dn.length + " horas capturadas" : "Sin captura", bar: sem(R1).c },
    { label: "Piezas empacadas", val: n0(sP), sub: "Meta " + n0(sM), bar: base },
    { label: "Tiempo de paro", val: sPar + " min", sub: "Por mantenimiento", bar: base },
    { label: "Cambio de bobina", val: sTcb + " min", sub: sB + " cambios en la jornada", bar: base },
    { label: "Tiempo trabajado", val: (sT / 60).toFixed(1) + " h", sub: sT + " min", bar: base },
  ];
  const w: { s: Sem; h: string; m: string }[] = [];
  items.forEach((c) => {
    if (c.has && c.rend! < 0.85) w.push({ s: A, h: c.lab + ":", m: `rendimiento ${pct(c.rend)} bajo la meta de ${n0(c.goal)} pzs.` });
    if (c.paro > 30) w.push({ s: A, h: c.lab + ":", m: `paro de ${c.paro} min.` });
    if (!c.has && (c.paro || c.bob || c.alm)) w.push({ s: R, h: c.lab + ":", m: "faltan las piezas empacadas." });
  });
  const warns = w.length ? w.slice(0, 5)
    : [{ s: G, h: "Sin observaciones.", m: dn.length ? "Las horas capturadas están dentro de la meta." : "Aún no hay horas capturadas." }];
  return { calc, acc, kpis, warns, hasErrors: w.some((x) => x.s === R), raw: { P: sP, M: sM, par: sPar } };
}
export { N };
