// Cálculo del día con los datos reales de Neon (programas, captura por batch/hora, entregas).
// `summarizeDay` es la única fuente de números: la usan el tablero y el detalle por máquina.
import { sql } from "./db";
import { loadConfig } from "./config-db";
import { compute, emptyRows, type Row } from "./capture";
import { MULTIVAC_IDS, MULTIVAC_NAMES, type Config } from "./config";
import { N, n0, pct, sem, type Sem } from "./domain";

type Db = ReturnType<typeof sql>;
type R = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
export type TabId = "ent" | "ter" | "mol" | "mk" | "embo" | "vac";
export type CardData = { title: string; big: string; bigLabel: string; st: Sem; tab: TabId; lines: { a: string; b: string }[]; foot: string };
export type TableroData = { day: string; days: string[]; headline: string; cards: CardData[]; month: { a: string; b: string }[] };
export type DayRaw = { progs: R[]; batch: R[]; hourly: R[]; deliv: R[] };

export const BATCH_TAB: Record<string, "Tecnovac" | "Termo MK" | "Embolsado" | "Polar"> = { mol: "Tecnovac", mk: "Termo MK", embo: "Embolsado", vac: "Polar" };
const MAQ = [{ name: "Termo MK", tab: "mk" }, { name: "Embolsado", tab: "embo" }, { name: "Polar", tab: "vac" }] as const;
export const ratio = (a: number, b: number) => (b > 0 ? a / b : null);

export async function recentDays(db: Db): Promise<string[]> {
  const r = await db`select to_char(day,'YYYY-MM-DD') as d from (
      select day from programs union select day from batch_records union select day from hourly_records union select day from deliveries) t
    order by day desc limit 5`;
  return r.map((x) => x.d as string).reverse();
}

// Datos crudos de varios días en 4 consultas.
export async function loadRaw(db: Db, days: string[]): Promise<Record<string, DayRaw>> {
  const [progs, batch, hourly, deliv] = await Promise.all([
    db`select to_char(p.day,'YYYY-MM-DD') as d, p.kind, p.article_id, a.description, a.process, p.qty from programs p join articles a on a.id = p.article_id where p.day = any(${days}::date[])`,
    db`select to_char(day,'YYYY-MM-DD') as d, machine, batch_no, to_char(real_time,'HH24:MI') as real, downtime_min, kg_melted, piece_kg, pieces, merma_kg from batch_records where day = any(${days}::date[])`,
    db`select to_char(day,'YYYY-MM-DD') as d, article_id, hour_idx, to_char(end_time,'HH24:MI') as fin, pieces, stored, downtime_min, reel_changes, reel_change_min from hourly_records where day = any(${days}::date[])`,
    db`select to_char(day,'YYYY-MM-DD') as d, article_id, qty from deliveries where day = any(${days}::date[])`,
  ]);
  const out: Record<string, DayRaw> = Object.fromEntries(days.map((d) => [d, { progs: [], batch: [], hourly: [], deliv: [] }]));
  for (const r of progs) out[r.d]?.progs.push(r);
  for (const r of batch) out[r.d]?.batch.push(r);
  for (const r of hourly) out[r.d]?.hourly.push(r);
  for (const r of deliv) out[r.d]?.deliv.push(r);
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
  const { progs, batch, hourly, deliv } = raw;
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
  // Multivac
  const mvReal: Record<number, number | null> = {};
  for (const id of MULTIVAC_IDS) {
    const rows = hourly.filter((h) => Number(h.article_id) === id);
    mvReal[id] = rows.some((h) => h.pieces != null) ? rows.reduce((a, h) => a + (Number(h.pieces) || 0), 0) : null;
  }
  const mvProg = MULTIVAC_IDS.reduce((a, id) => a + (progMv[id] ?? 0), 0);
  const mvDone = MULTIVAC_IDS.filter((id) => mvReal[id] != null);
  const mvRealSum = mvDone.reduce((a, id) => a + (mvReal[id] as number), 0);
  // Solo se compara contra el programa de los productos ya capturados.
  const mvRatio = mvDone.length ? ratio(mvRealSum, mvDone.reduce((a, id) => a + (progMv[id] ?? 0), 0)) : null;
  // máquinas por batch
  const machines = {} as Record<"Tecnovac" | "Termo MK" | "Embolsado" | "Polar", { c: ReturnType<typeof compute>; prog: { qty: number; n: number }; ratio: number | null; hasRows: boolean }>;
  for (const m of ["Tecnovac", "Termo MK", "Embolsado", "Polar"] as const) {
    const c = compute(m, rowsOf(batch, m), { ...cfg.batch[m], tolerance: cfg.tolerance });
    const prog = progByProc[m] ?? { qty: 0, n: 0 };
    machines[m] = { c, prog, ratio: c.raw.sPz > 0 ? ratio(c.raw.sPz, prog.qty) : null, hasRows: batch.some((b) => b.machine === m) };
  }
  return {
    progByProc, progMv, progEnt, progEntById, delById, hasDeliv,
    ent: { tot: entTot, capped: entCapped, falt: entFalt, exc: entExc, full: entFull, withProg: entWithProg, fill: ratio(entCapped, progEnt), vol: ratio(entTot, progEnt) },
    mvReal, mvProg, mvDone, mvRealSum, mvRatio, machines,
  };
}

export async function loadTablero(db: Db, day: string, days: string[]): Promise<TableroData> {
  const cfg = await loadConfig(db);
  const S = summarizeDay((await loadRaw(db, [day]))[day], cfg);

  const entCard: CardData = S.hasDeliv
    ? { title: "Entregas de PT", big: pct(S.ent.fill), bigLabel: "Fill rate", st: sem(S.ent.fill), tab: "ent",
        lines: [{ a: "Cumplimiento en volumen", b: pct(S.ent.vol) }, { a: "SKUs completos", b: `${S.ent.full} de ${S.ent.withProg}` },
                { a: "Piezas faltantes", b: n0(S.ent.falt) }, { a: "Piezas excedentes", b: n0(S.ent.exc) }],
        foot: `Programadas ${n0(S.progEnt)} · entregadas ${n0(S.ent.tot)}` }
    : { title: "Entregas de PT", big: "—", bigLabel: "Fill rate", st: N, tab: "ent",
        lines: [{ a: "Sin registro de entregas", b: "" }], foot: S.progEnt ? `Programadas ${n0(S.progEnt)}` : "" };

  const mvCard: CardData = { title: "Multivac", big: pct(S.mvRatio), bigLabel: "Cumplimiento", st: sem(S.mvRatio), tab: "ter",
    lines: MULTIVAC_IDS.map((id) => ({ a: MULTIVAC_NAMES[id], b: S.mvReal[id] != null ? pct(ratio(S.mvReal[id] as number, S.progMv[id] ?? 0)) : "Sin captura" })),
    foot: S.mvProg ? `Programa ${n0(S.mvProg)}${S.mvDone.length ? ` · logrado ${n0(S.mvRealSum)}` : ""}` : "Sin programa de empaque" };

  const t = S.machines.Tecnovac, tr = t.c.raw, pedido = t.prog.qty;
  const tecnoCard: CardData = { title: "Tecnovac", big: pct(t.ratio), bigLabel: "Cumplimiento", st: sem(t.ratio), tab: "mol",
    lines: tr.sKg > 0
      ? [{ a: "Batches a tiempo", b: tr.nTimed ? `${pct(tr.onT / tr.nTimed)} (${tr.onT} de ${tr.nTimed})` : "—" }, { a: "Rendimiento", b: pct(tr.sTm / tr.sKg) },
         { a: "Desecho", b: pct(tr.sDes / tr.sKg) },
         { a: tr.tg ? `Sobrepeso vs ${Math.round(tr.tg * 1000)} g` : "Sobrepeso", b: tr.tg && isFinite(tr.avgPeso) ? "+" + ((tr.avgPeso / tr.tg - 1) * 100).toFixed(1) + "%" : "—" }]
      : [{ a: "Sin captura", b: "" }],
    foot: pedido ? `Pedido ${n0(pedido)}${tr.sPz ? ` · empacado ${n0(tr.sPz)}` : ""}` : "Sin programa de empaque" };

  const others: CardData[] = MAQ.map(({ name, tab }) => {
    const m = S.machines[name];
    return { title: name, big: pct(m.ratio), bigLabel: "Cumplimiento", st: sem(m.ratio), tab,
      lines: [{ a: "Programa de empaque", b: n0(m.prog.qty) + " pzs." }, { a: "Artículos con programa", b: String(m.prog.n) },
              { a: "Empacado", b: m.c.raw.sPz > 0 ? n0(m.c.raw.sPz) + " pzs." : "Sin captura" }], foot: "" };
  });

  const part = (name: string, v: number | null) => (v == null ? `${name} sin captura` : `${name} ${pct(v)}`);
  const headline = [part("Multivac", S.mvRatio), S.hasDeliv ? `entregas ${entCard.big} fill rate` : "sin registro de entregas", part("Tecnovac", t.ratio)].join(" · ");
  return { day, days, headline, cards: [entCard, mvCard, tecnoCard, ...others], month: await monthToDate(db, day) };
}

async function monthToDate(db: Db, day: string): Promise<{ a: string; b: string }[]> {
  const mv = MULTIVAC_IDS as readonly number[];
  const [del, mvr] = await Promise.all([
    db`with m as (select date_trunc('month', ${day}::date)::date as d0),
            dd as (select distinct day from deliveries, m where day >= m.d0 and day <= ${day}::date),
            p as (select p.day, p.article_id, p.qty as prog from programs p join dd on dd.day = p.day where p.kind = 'entregas')
       select coalesce(sum(p.prog),0)::bigint as prog,
              (select coalesce(sum(qty),0) from deliveries, m where day >= m.d0 and day <= ${day}::date)::bigint as entregado,
              coalesce(sum(least(coalesce(d.qty,0), p.prog)),0)::bigint as capped
       from p left join deliveries d on d.day = p.day and d.article_id = p.article_id`,
    db`with m as (select date_trunc('month', ${day}::date)::date as d0),
            hd as (select day, article_id, sum(pieces) as real from hourly_records, m
                   where day >= m.d0 and day <= ${day}::date and article_id = any(${mv}::int[]) group by day, article_id having sum(pieces) is not null)
       select coalesce(sum(hd.real),0)::bigint as real,
              (select coalesce(sum(p.qty),0) from programs p where p.kind = 'empaque' and p.article_id = any(${mv}::int[])
                 and p.day in (select day from hd)) ::bigint as prog
       from hd`,
  ]);
  const d = del[0], m = mvr[0];
  const prog = Number(d.prog), ent = Number(d.entregado), capped = Number(d.capped);
  return [
    { a: "Entregas", b: prog ? `${pct(ratio(ent, prog))} vol · ${pct(ratio(capped, prog))} fill` : "—" },
    { a: "Multivac", b: Number(m.prog) ? pct(ratio(Number(m.real), Number(m.prog))) : "—" },
    { a: "Piezas entregadas", b: prog ? `${n0(ent)} de ${n0(prog)}` : "—" },
  ];
}
