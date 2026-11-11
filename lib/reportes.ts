// Reportes imprimibles / exportables. Cada reporte es una tabla simple: encabezados y filas.
import { sql } from "./db";
import { loadConfig } from "./config-db";
import { compute, hasDowntime } from "./capture";
import { computeHourly } from "./multivac";
import { MULTIVAC_IDS, MULTIVAC_NAMES } from "./config";
import { dayLong, sem } from "./domain";
import { hRowsOf } from "./detalle";
import { BATCH_TAB, loadRaw, loadTablero, ratio, recentDays, rowsOf, summarizeDay } from "./tablero";

type Db = ReturnType<typeof sql>;
import type { Cell, ReportData, Params } from "./reportes-list";
export type { Cell, ReportData, Params } from "./reportes-list";
export { REPORT_LIST, REPORT_MACHINES } from "./reportes-list";

const num = (v: string) => (v === "" || !isFinite(Number(v)) ? "" : Number(v));
const label = (r: number | null) => (r == null ? "Sin dato" : sem(r).l);
const pctTxt = (r: number | null) => (r == null ? "—" : (r * 100).toFixed(1) + "%");

export async function buildReport(db: Db, id: string, p: Params): Promise<ReportData> {
  const sub0 = "Jornada " + dayLong(p.day);
  const procSub = "Proceso: " + (p.process === "all" ? "todos" : p.process);

  if (id === "tablero") {
    const t = await loadTablero(db, p.day, await recentDays(db));
    const rows: Cell[][] = [];
    for (const c of t.cards) { rows.push([c.title, c.bigLabel, c.big]); for (const l of c.lines) if (l.b !== "") rows.push([c.title, l.a, l.b]); }
    return { id, name: "Resumen del día", sheet: "Resumen", sub: sub0, head: ["Proceso", "Indicador", "Valor"], rows };
  }

  const cfg = await loadConfig(db);
  const raw = (await loadRaw(db, [p.day]))[p.day];
  const S = summarizeDay(raw, cfg);

  if (id === "entregas") {
    const arts = await db`select id, description, process from articles`;
    const info = new Map(arts.map((a) => [Number(a.id), a]));
    const ids = [...new Set([...S.progEntById.keys(), ...S.delById.keys()])].sort((a, b) => a - b);
    const rows = ids.map((i) => {
      const a = info.get(i), pr = S.progEntById.get(i) ?? 0, has = S.delById.has(i), d = S.delById.get(i) ?? 0, r = pr > 0 && has ? d / pr : null;
      return { i, a, pr, has, d, r };
    }).filter((x) => (x.pr > 0 || x.has) && (p.process === "all" || x.a?.process === p.process))
      .map((x): Cell[] => [x.i, String(x.a?.description ?? "").trim(), String(x.a?.process ?? ""), x.pr, x.has ? x.d : "", x.has ? x.d - x.pr : "", pctTxt(x.r), label(x.r)]);
    return { id, name: "Entregas de PT por artículo", sheet: "Entregas", sub: `${sub0} · ${procSub}`, head: ["Artículo", "Descripción", "Proceso", "Prog. entregas", "Entregado", "Diferencia", "%", "Estado"], rows };
  }

  if (id === "empaque") {
    const row = (name: string, prog: number, real: number | null): Cell[] => {
      const r = real == null ? null : ratio(real, prog);
      return [name, prog, real ?? "", real == null ? "" : real - prog, pctTxt(r), label(r)];
    };
    const rows: Cell[][] = [row("Tecnovac", S.machines.Tecnovac.prog.qty, S.machines.Tecnovac.c.raw.sPz || null)];
    // Igual que en el tablero: solo se compara contra el programa de los productos ya capturados.
    const mvProg = S.mvDone.length ? S.mvDone.reduce((a, i) => a + (S.progMv[i] ?? 0), 0) : S.mvProg;
    rows.push(row("Multivac", mvProg, S.mvDone.length ? S.mvRealSum : null));
    for (const m of ["Termo MK", "Embolsado", "Polar"] as const) rows.push(row(m, S.machines[m].prog.qty, S.machines[m].c.raw.sPz || null));
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

  if (id === "programas") {
    const by = new Map<number, { d: string; proc: string; e: number; g: number }>();
    for (const r of raw.progs) {
      const o = by.get(Number(r.article_id)) ?? { d: String(r.description).trim(), proc: r.process, e: 0, g: 0 };
      if (r.kind === "empaque") o.e = Number(r.qty); else o.g = Number(r.qty);
      by.set(Number(r.article_id), o);
    }
    const rows = [...by].sort((a, b) => a[0] - b[0]).filter(([, o]) => (o.e > 0 || o.g > 0) && (p.process === "all" || o.proc === p.process))
      .map(([i, o]): Cell[] => [i, o.d, o.proc, o.e, o.g]);
    return { id, name: "Programas de empaque y entregas", sheet: "Programas", sub: `${sub0} · ${procSub}`, head: ["Artículo", "Descripción", "Proceso", "Prog. empaque", "Prog. entregas"], rows };
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
  for (const id of ["tablero", "entregas", "empaque", "programas"]) out.push(await buildReport(db, id, { ...p, process: "all" }));
  for (const m of ["Tecnovac", "Termo MK", "Embolsado", "Polar"]) { const r = await buildReport(db, "batches", { ...p, machine: m }); out.push({ ...r, sheet: `Batches ${m}` }); }
  for (const pid of MULTIVAC_IDS) { const r = await buildReport(db, "batches", { ...p, machine: "Multivac", product: pid }); out.push({ ...r, sheet: `Multivac ${MULTIVAC_NAMES[pid]}`.slice(0, 31) }); }
  out.push(await buildReport(db, "bitacora", p));
  return out;
}
