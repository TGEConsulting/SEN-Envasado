// Reportes imprimibles / exportables. Cada reporte es una tabla simple: encabezados y filas.
import { sql } from "./db";
import { loadConfig } from "./config-db";
import { compute, hasDowntime } from "./capture";
import { computeHourly } from "./multivac";
import { MULTIVAC_IDS, MULTIVAC_NAMES } from "./config";
import { dayLong, sem } from "./domain";
import { hRowsOf } from "./detalle";
import { BATCH_TAB, loadRaw, loadTablero, ratio, recentDays, rowsOf, summarizeDay } from "./tablero";
import { dayName, monthRange, weekRange } from "./calendario";
import { loadCatalog, loadPeriodo } from "./periodo-db";
import { pareto, type ArtRow, type Periodo } from "./periodo";

type Db = ReturnType<typeof sql>;
import type { Cell, ReportData, Params, Section } from "./reportes-list";
export type { Cell, ReportData, Params } from "./reportes-list";
export { REPORT_LIST, REPORT_MACHINES } from "./reportes-list";

const num = (v: string) => (v === "" || !isFinite(Number(v)) ? "" : Number(v));
const label = (r: number | null) => (r == null ? "Sin dato" : sem(r).l);
const pctTxt = (r: number | null) => (r == null ? "—" : (r * 100).toFixed(1) + "%");


const f2 = (n: number) => Math.round(n * 100) / 100;
const ART_HEAD = ["Número de artículo", "Descripción del artículo", "Pesaje", "Fórmula", "Programa empaque", "Programa entregas CR100", "Total empaque", "Total entregas CR100", "Kilos totales de empaque", "Kilos totales de entregas CR100", "% cumplimiento empaque", "% cumplimiento entregas", "Inventario"];
const artRow = (a: ArtRow): Cell[] => [a.id, a.description, a.pesaje ?? "", a.formula ?? "", a.progE, a.progG, a.realE, a.realG, f2(a.kgE), f2(a.kgG), pctTxt(a.cumplE), pctTxt(a.cumplG), a.inv ?? ""];
const artTotal = (a: ArtRow[], t: Periodo["total"], label: string): Cell[] => ["", label, "", "", t.progE, t.progG, t.realE, t.realG, f2(t.kgE), f2(t.kgG), pctTxt(t.cumplE), pctTxt(t.cumplG), t.inv];
const dayRowsOf = (p: Periodo): Cell[][] => [
  ...p.rows.map((r): Cell[] => [r.date, r.day, r.state, r.progE ?? "", r.realE ?? "", pctTxt(r.cumplE), r.progG ?? "", r.realG ?? "", pctTxt(r.cumplG), r.kgE == null ? "" : f2(r.kgE), r.kgG == null ? "" : f2(r.kgG)]),
  ["", "TOTAL", `${p.con} de ${p.operativos} días`, p.total.progE, p.total.realE, pctTxt(p.total.cumplE), p.total.progG, p.total.realG, pctTxt(p.total.cumplG), f2(p.total.kgE), f2(p.total.kgG)],
];
const DAY_HEAD = ["Fecha", "Día", "Estado de captura", "Programa empaque", "Real empaque", "Cumpl. empaque", "Programa CR100", "Real CR100", "Cumpl. CR100", "Kg empaque", "Kg CR100"];

async function periodReport(db: Db, kind: "wtd" | "mtd", day: string): Promise<ReportData> {
  const wk = weekRange(day), mo = monthRange(day), r = kind === "wtd" ? wk : mo;
  const cut = day < r.to ? day : r.to;
  const { periodo } = await loadPeriodo(db, r.from, r.to, cut);
  const name = kind === "wtd" ? `Semana ${wk.label.slice(1)} | Resumen WTD` : `${new Date(mo.from + "T12:00:00Z").toLocaleDateString("es-MX", { month: "long", year: "numeric", timeZone: "UTC" })} | Resumen MTD`;
  const sub = `Fecha de corte ${cut} · ${r.from} a ${r.to} · lunes a sábado, domingo excluido. Cumplimiento ponderado = real acumulado / programa acumulado. Inventario: último valor capturado hasta el corte.`;
  const det: Section = { title: `Detalle ${kind.toUpperCase()} · ${periodo.articles.length} artículos · piezas y kilogramos`, head: ART_HEAD, rows: [...periodo.articles.map(artRow), artTotal(periodo.articles, periodo.total, `TOTAL ${kind.toUpperCase()}`)] };
  return { id: kind, name, sheet: kind === "wtd" ? `Resumen WTD ${wk.label}` : "Resumen MTD", sub, head: DAY_HEAD, rows: dayRowsOf(periodo), sections: [det] };
}

async function paretoReport(db: Db, kind: "wtd" | "mtd", day: string): Promise<ReportData> {
  const wk = weekRange(day), mo = monthRange(day), r = kind === "wtd" ? wk : mo, cut = day < r.to ? day : r.to;
  const { periodo } = await loadPeriodo(db, r.from, r.to, cut);
  const mk = (key: "realG" | "kgG") => pareto(periodo.articles.map((a) => ({ id: a.id, description: a.description, short: a.short, value: a[key] })));
  const pz = mk("realG"), kg = mk("kgG");
  const detail = (p: typeof pz, unit: string): Cell[][] => p.items.map((i) => [i.id, i.description, unit === "kg" ? f2(i.value) : i.value, pctTxt(i.pct), pctTxt(i.cum), i.tramo, i.short]);
  const dh = (u: string) => ["Artículo", "Descripción", u, "% del total", "% acumulado", "Tramo Pareto", "Descripción corta"];
  const row = (m: string, p: typeof pz, kgs: boolean): Cell[] => [m, kgs ? f2(p.total) : p.total, p.n80, pctTxt(p.cum80), pctTxt(p.pctCatalogo), pctTxt(p.topShare)];
  const ref = `Top 20% = ${pz.topN} de ${periodo.articles.length} artículos (redondeo superior). Se incluyen artículos sin entregas.`;
  return { id: `pareto_${kind}`, name: `Pareto 80/20 | Entregas CR100 · ${kind.toUpperCase()} · ${kind === "wtd" ? "semana " + wk.label.slice(1) : "mes"}`,
    sheet: `Pareto ${kind === "wtd" ? "WTD " + wk.label : "MTD"}`, sub: `Fecha de corte ${cut} · ${r.from} a ${r.to}. ${ref}`,
    head: ["Métrica", "Total", "Artículos para ≥80%", "% acumulado alcanzado", "% del catálogo para ≥80%", "Participación del top 20%"],
    rows: [row("Piezas entregadas", pz, false), row("Kg entregados", kg, true)],
    sections: [{ title: "Detalle ordenado | piezas entregadas", head: dh("Piezas"), rows: detail(pz, "pzs") }, { title: "Detalle ordenado | kg entregados", head: dh("Kg"), rows: detail(kg, "kg") }] };
}

async function dailyReport(db: Db, day: string): Promise<ReportData> {
  const [catalog, progs, packed, deliv, inv] = await Promise.all([
    loadCatalog(db),
    db`select kind, article_id, qty from programs where day = ${day}::date`,
    db`select article_id, qty from packed where day = ${day}::date`,
    db`select article_id, qty from deliveries where day = ${day}::date`,
    db`select article_id, qty from inventory where day = ${day}::date`,
  ]);
  const pe = new Map<number, number>(), pg = new Map<number, number>();
  for (const r of progs) (r.kind === "empaque" ? pe : pg).set(Number(r.article_id), Number(r.qty));
  const pk = new Map(packed.map((r) => [Number(r.article_id), Number(r.qty)])), dv = new Map(deliv.map((r) => [Number(r.article_id), Number(r.qty)])), iv = new Map(inv.map((r) => [Number(r.article_id), Number(r.qty)]));
  const arts: ArtRow[] = catalog.map((a) => {
    const progE = pe.get(a.id) ?? 0, progG = pg.get(a.id) ?? 0, realE = pk.get(a.id) ?? 0, realG = dv.get(a.id) ?? 0, k = a.pesaje ?? 0;
    return { id: a.id, description: a.description, short: a.short ?? a.description, pesaje: a.pesaje, formula: a.formula, progE, progG, realE, realG, kgE: realE * k, kgG: realG * k, cumplE: ratio(realE, progE), cumplG: ratio(realG, progG), inv: iv.get(a.id) ?? null };
  });
  const sumOf = (f: (a: ArtRow) => number) => arts.reduce((s, a) => s + f(a), 0);
  const t = { progE: sumOf((a) => a.progE), realE: sumOf((a) => a.realE), progG: sumOf((a) => a.progG), realG: sumOf((a) => a.realG), kgE: sumOf((a) => a.kgE), kgG: sumOf((a) => a.kgG), inv: sumOf((a) => a.inv ?? 0), cumplE: null as number | null, cumplG: null as number | null };
  t.cumplE = ratio(t.realE, t.progE); t.cumplG = ratio(t.realG, t.progG);
  return { id: "diario", name: `Programa empaque - entregas | ${dayName(day)} ${day}`, sheet: "Diario", sub: "Real = TOTAL EMPAQUE y TOTAL ENTREGAS CR100. Kilos = piezas × pesaje. Sin semáforo cuando el programa es cero.",
    head: ART_HEAD, rows: [...arts.map(artRow), artTotal(arts, t, "TOTAL")] };
}

export async function buildReport(db: Db, id: string, p: Params): Promise<ReportData> {
  const sub0 = "Jornada " + dayLong(p.day);
  const procSub = "Proceso: " + (p.process === "all" ? "todos" : p.process);

  if (id === "tablero") {
    const t = await loadTablero(db, p.day, await recentDays(db));
    const rows: Cell[][] = [];
    for (const c of t.cards) { rows.push([c.title, c.bigLabel, c.big]); for (const l of c.lines) if (l.b !== "") rows.push([c.title, l.a, l.b]); }
    return { id, name: "Resumen del día", sheet: "Resumen", sub: sub0, head: ["Proceso", "Indicador", "Valor"], rows };
  }

  if (id === "diario") return dailyReport(db, p.day);
  if (id === "wtd" || id === "mtd") return periodReport(db, id, p.day);
  if (id === "pareto_wtd") return paretoReport(db, "wtd", p.day);
  if (id === "pareto_mtd") return paretoReport(db, "mtd", p.day);
  const cfg = await loadConfig(db);
  const raw = (await loadRaw(db, [p.day]))[p.day];
  const S = summarizeDay(raw, cfg);

  if (id === "empaque") {
    const row = (name: string, prog: number, real: number | null): Cell[] => {
      const r = real == null ? null : ratio(real, prog);
      return [name, prog, real ?? "", real == null ? "" : real - prog, pctTxt(r), label(r)];
    };
    const rows: Cell[][] = [row("Tecnovac", S.machines.Tecnovac.prog.qty, S.machines.Tecnovac.real)];
    // Igual que en el tablero: solo se compara contra el programa de los productos ya capturados.
    const mvProg = S.mvDone.length ? S.mvDone.reduce((a, i) => a + (S.progMv[i] ?? 0), 0) : S.mvProg;
    rows.push(row("Multivac", mvProg, S.mvDone.length ? S.mvRealSum : null));
    for (const m of ["Termo MK", "Embolsado", "Polar"] as const) rows.push(row(m, S.machines[m].prog.qty, S.machines[m].real));
    return { id, name: "Empaque contra programa", sheet: "Empaque", sub: sub0, head: ["Máquina", "Programado", "Empacado", "Diferencia", "%", "Estado"], rows };
  }

  if (id === "batches") {
    if (p.machine === "Multivac") {
      const pid = (MULTIVAC_IDS as readonly number[]).includes(p.product) ? p.product : MULTIVAC_IDS[0];
      const hr = hRowsOf(raw, pid), h = computeHourly(hr, cfg.hourly.starts, cfg.hourly.goals[pid]);
      return { id, name: "Empaque por hora · Multivac", sheet: "Batches", sub: `Multivac · ${MULTIVAC_NAMES[pid]} · ${sub0}`,
        head: ["Hora inicio", "Hora final", "Meta", "Piezas empacadas", "Diferencias", "Rendimiento", "Almacenamiento", "Paro mto. (min)", "Cambios de bobina", "Tiempo cambio bobina (min)", "Tiempo trabajado"],
        rows: h.calc.map((c, i): Cell[] => [c.ini, hr[i].fin, c.meta === "—" ? "" : Number(c.meta.replace(/,/g, "")), num(hr[i].pzs), c.diff, c.rend, num(hr[i].alm), num(hr[i].paro), num(hr[i].bob), num(hr[i].tcb), c.trab]) };
    }
    const m = (Object.values(BATCH_TAB) as string[]).includes(p.machine) ? (p.machine as "Tecnovac" | "Termo MK" | "Embolsado" | "Polar") : "Tecnovac";
    const rows = rowsOf(raw.batch, m), c = compute(m, rows, { ...cfg.batch[m], tolerance: cfg.tolerance });
    return { id, name: `Batches · ${m}`, sheet: "Batches", sub: `Máquina ${m} · ${sub0}${hasDowntime(m) ? "" : " · esta máquina no registra paro"}`,
      head: ["Batch", "Esperada", "Hora real", "Retraso", "Kg fundidos", "Peso pza (kg)", "Pzs empacadas", "Meta de piezas", "Dif. vs meta", "Total kg", "Merma kg", "Total + merma", "Rendim.", "Kg desecho", "% desecho", "Paro por MTO. (min)"],
      rows: c.calc.map((x): Cell[] => { const r = rows[x.n - 1];
        return [x.n, x.exp, r.real, x.retTxt, num(r.kg), num(r.peso), num(r.pzs), x.meta, x.dm, x.tot, num(r.mer), x.tm, x.rend, x.des, x.pdes, num(r.paro)]; }) };
  }

  // bitácora (no depende del día): últimos 1000 movimientos
  const log = await db`select to_char(l.at at time zone 'America/Mexico_City', 'DD/MM/YYYY HH24:MI') as ts, coalesce(u.email, 'Sistema') as usuario, l.program,
      coalesce(to_char(l.day, 'YYYY-MM-DD'), '') as dia, l.article_id, coalesce(a.description, '') as descr, l.old_value, l.new_value, l.reason
    from audit_log l left join users u on u.id = l.user_id left join articles a on a.id = l.article_id order by l.at desc, l.id desc limit 1000`;
  const n = (v: string | null) => (v != null && v !== "" && isFinite(Number(v)) ? Number(v) : null);
  return { id: "bitacora", name: "Bitácora de cambios", sheet: "Bitácora", sub: `${log.length} registro(s) más recientes`,
    head: ["Fecha y hora", "Usuario", "Programa", "Día", "Artículo", "Descripción", "Anterior", "Nuevo", "Cambio", "Motivo"],
    rows: log.map((l): Cell[] => { const a = n(l.old_value), b = n(l.new_value);
      return [l.ts, l.usuario, l.program, l.dia, l.article_id ?? "", String(l.descr).trim(), l.old_value ?? "", l.new_value ?? "", a != null && b != null ? b - a : "", l.reason]; }) };
}

// Libro completo: una hoja por reporte (y por máquina / producto de Multivac).
export async function buildAll(db: Db, p: Params): Promise<ReportData[]> {
  const out: ReportData[] = [];
  for (const id of ["tablero", "diario", "wtd", "mtd", "pareto_wtd", "pareto_mtd", "empaque"]) out.push(await buildReport(db, id, p));
  for (const m of ["Tecnovac", "Termo MK", "Embolsado", "Polar"]) { const r = await buildReport(db, "batches", { ...p, machine: m }); out.push({ ...r, sheet: `Batches ${m}` }); }
  for (const pid of MULTIVAC_IDS) { const r = await buildReport(db, "batches", { ...p, machine: "Multivac", product: pid }); out.push({ ...r, sheet: `Multivac ${MULTIVAC_NAMES[pid]}`.slice(0, 31) }); }
  out.push(await buildReport(db, "bitacora", p));
  return out;
}
