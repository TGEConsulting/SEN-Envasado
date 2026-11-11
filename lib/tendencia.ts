// Tendencia: indicadores de los últimos 5 días con semáforo, y acumulado del mes.
import { sql } from "./db";
import { loadConfig } from "./config-db";
import { dayChip, n0, pct, sem } from "./domain";
import { MULTIVAC_IDS, MULTIVAC_NAMES } from "./config";
import { loadRaw, ratio, summarizeDay } from "./tablero";
import { monthRange } from "./calendario";
import { loadPeriodo } from "./periodo-db";

type Db = ReturnType<typeof sql>;
export type Cell = { t: string; bg: string; ink: string };
export type Tendencia = { day: string; labels: string[]; rows: { group: string; label: string; cells: Cell[] }[]; month: { a: string; b: string; c: string }[] };

const none: Cell = { t: "—", bg: "transparent", ink: "var(--color-neutral-700)" };
const cellS = (v: number | null): Cell => (v == null ? none : { t: pct(v), bg: sem(v).t, ink: sem(v).i });
const cellN = (v: number | null, f: (x: number) => string): Cell => (v == null ? none : { t: f(v), bg: "#eaf1f8", ink: "var(--color-text)" });

export async function loadTendencia(db: Db, day: string, days: string[]): Promise<Tendencia> {
  const cfg = await loadConfig(db);
  const all = [...new Set([...days, day])].sort().slice(-5);
  const raws = await loadRaw(db, all);
  const S = all.map((d) => summarizeDay(raws[d], cfg));
  const row = (group: string, label: string, f: (s: (typeof S)[number]) => number | null, kind: "s" | "n" = "s", fmt: (x: number) => string = pct) =>
    ({ group, label, cells: S.map((s) => (kind === "s" ? cellS(f(s)) : cellN(f(s), fmt))) });
  const tec = (s: (typeof S)[number]) => s.machines.Tecnovac.c.raw;
  const rows = [
    row("Empaque", "Cumplimiento", (s) => s.cumplE),
    row("Entregas CR100", "Cumplimiento", (s) => (s.hasDeliv ? s.ent.vol : null)),
    row("Multivac", "Total", (s) => s.mvRatio),
    ...MULTIVAC_IDS.map((id) => row("Multivac", MULTIVAC_NAMES[id], (s) => (s.mvReal[id] != null ? ratio(s.mvReal[id] as number, s.progMv[id] ?? 0) : null))),
    row("Tecnovac", "Cumplimiento", (s) => s.machines.Tecnovac.ratio),
    row("Tecnovac", "Rendimiento", (s) => (tec(s).sKg > 0 ? tec(s).sTm / tec(s).sKg : null)),
    row("Tecnovac", "Batches a tiempo", (s) => (tec(s).nTimed ? tec(s).onT / tec(s).nTimed : null)),
    row("Tecnovac", "Desecho", (s) => (tec(s).sKg > 0 ? tec(s).sDes / tec(s).sKg : null), "n"),
    row("Tecnovac", "Sobrepeso", (s) => (tec(s).tg && isFinite(tec(s).avgPeso) ? tec(s).avgPeso / tec(s).tg - 1 : null), "n", (x) => (x >= 0 ? "+" : "") + (x * 100).toFixed(1) + "%"),
    ...(["Termo MK", "Embolsado", "Polar"] as const).map((m) => row(m, "Cumplimiento", (s) => s.machines[m].ratio)),
  ];

  // acumulado del mes (hasta el día elegido): empaque y entregas ponderados, como en el libro
  const mo = monthRange(day), { periodo: mtd } = await loadPeriodo(db, mo.from, mo.to, day);
  const t = mtd.total;
  const mvM = MULTIVAC_IDS.map((id) => { const a = mtd.articles.find((x) => x.id === id)!; return a.progE > 0 ? a : null; });
  const mvReal = mvM.reduce((s, a) => s + (a?.realE ?? 0), 0), mvProg = mvM.reduce((s, a) => s + (a?.progE ?? 0), 0);
  const month = [
    { a: "Empaque · cumplimiento", b: pct(t.cumplE), c: t.progE ? `${n0(t.realE)} de ${n0(t.progE)} pzs.` : "Sin captura en el mes" },
    { a: "Entregas · cumplimiento", b: pct(t.cumplG), c: t.progG ? `${n0(t.realG)} de ${n0(t.progG)} pzs.` : "Sin captura en el mes" },
    { a: "Multivac", b: mvProg ? pct(ratio(mvReal, mvProg)) : "—", c: mvProg ? `${n0(mvReal)} de ${n0(mvProg)} pzs.` : "Sin captura en el mes" },
    { a: "Multivac por producto", b: mvM.map((a) => (a ? (a.cumplE == null ? "—" : (a.cumplE * 100).toFixed(1) + "%") : "—")).join(" · "), c: MULTIVAC_IDS.map((id) => MULTIVAC_NAMES[id].split(" ")[0]).join(" · ") },
  ];
  return { day, labels: all.map(dayChip), rows, month };
}
