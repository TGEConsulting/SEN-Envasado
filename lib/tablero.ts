// Tablero del día calculado con los datos reales de Neon (programas, captura por batch/hora, entregas).
import { sql } from "./db";
import { loadConfig } from "./config-db";
import { compute, emptyRows, type Row } from "./capture";
import { computeHourly, emptyHRows } from "./multivac";
import { MULTIVAC_IDS, MULTIVAC_NAMES, type Config } from "./config";
import { N, n0, pct, sem, type Sem } from "./domain";

type Db = ReturnType<typeof sql>;
export type TabId = "ent" | "ter" | "mol" | "mk" | "embo" | "vac";
export type CardData = { title: string; big: string; bigLabel: string; st: Sem; tab: TabId; lines: { a: string; b: string }[]; foot: string };
export type TableroData = { day: string; days: string[]; headline: string; cards: CardData[]; month: { a: string; b: string }[] };

const MAQ: { name: "Termo MK" | "Embolsado" | "Polar"; tab: TabId }[] = [
  { name: "Termo MK", tab: "mk" }, { name: "Embolsado", tab: "embo" }, { name: "Polar", tab: "vac" },
];
const ratio = (a: number, b: number) => (b > 0 ? a / b : null);

export async function recentDays(db: Db): Promise<string[]> {
  const r = await db`select to_char(day,'YYYY-MM-DD') as d from (
      select day from programs union select day from batch_records union select day from hourly_records union select day from deliveries) t
    order by day desc limit 5`;
  return r.map((x) => x.d as string).reverse();
}

export async function loadTablero(db: Db, day: string, days: string[]): Promise<TableroData> {
  const cfg = await loadConfig(db);
  const [progs, batch, hourly, deliv] = await Promise.all([
    db`select p.kind, p.article_id, a.process, p.qty from programs p join articles a on a.id = p.article_id where p.day = ${day}`,
    db`select machine, batch_no, to_char(real_time,'HH24:MI') as real, downtime_min, kg_melted, piece_kg, pieces, merma_kg from batch_records where day = ${day}`,
    db`select article_id, hour_idx, to_char(end_time,'HH24:MI') as fin, pieces, stored, downtime_min, reel_changes, reel_change_min from hourly_records where day = ${day}`,
    db`select article_id, qty from deliveries where day = ${day}`,
  ]);

  // ── programas ──
  const progByProc: Record<string, { qty: number; n: number }> = {};
  const progMv: Record<number, number> = {};
  let progEnt = 0;
  const progEntById = new Map<number, number>();
  for (const r of progs) {
    const q = Number(r.qty);
    if (r.kind === "empaque") {
      const p = (progByProc[r.process] ??= { qty: 0, n: 0 }); p.qty += q; if (q > 0) p.n++;
      if (r.process === "Multivac") progMv[Number(r.article_id)] = q;
    } else { progEnt += q; progEntById.set(Number(r.article_id), q); }
  }

  // ── entregas ──
  let entCard: CardData;
  if (deliv.length) {
    const delById = new Map(deliv.map((r) => [Number(r.article_id), Number(r.qty)]));
    const ids = new Set([...progEntById.keys(), ...delById.keys()]);
    let tot = 0, capped = 0, falt = 0, exc = 0, full = 0, withProg = 0;
    for (const id of ids) {
      const p = progEntById.get(id) ?? 0, d = delById.get(id) ?? 0;
      tot += d; capped += Math.min(d, p); falt += Math.max(p - d, 0); exc += Math.max(d - p, 0);
      if (p > 0) { withProg++; if (d >= p) full++; }
    }
    const fill = ratio(capped, progEnt);
    entCard = { title: "Entregas de PT", big: pct(fill), bigLabel: "Fill rate", st: sem(fill), tab: "ent",
      lines: [{ a: "Cumplimiento en volumen", b: pct(ratio(tot, progEnt)) }, { a: "SKUs completos", b: `${full} de ${withProg}` },
              { a: "Piezas faltantes", b: n0(falt) }, { a: "Piezas excedentes", b: n0(exc) }],
      foot: `Programadas ${n0(progEnt)} · entregadas ${n0(tot)}` };
  } else {
    entCard = { title: "Entregas de PT", big: "—", bigLabel: "Fill rate", st: N, tab: "ent",
      lines: [{ a: "Sin registro de entregas", b: "" }], foot: progEnt ? `Programadas ${n0(progEnt)}` : "" };
  }

  // ── Multivac (captura por hora vs programa de empaque) ──
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
  const mvCard: CardData = { title: "Multivac", big: pct(mvRatio), bigLabel: "Cumplimiento", st: sem(mvRatio), tab: "ter",
    lines: MULTIVAC_IDS.map((id) => ({ a: MULTIVAC_NAMES[id], b: mvReal[id] != null ? pct(ratio(mvReal[id] as number, progMv[id] ?? 0)) : "Sin captura" })),
    foot: mvProg ? `Programa ${n0(mvProg)}${mvDone.length ? ` · logrado ${n0(mvRealSum)}` : ""}` : "Sin programa de empaque" };

  // ── máquinas por batch ──
  const rowsOf = (m: string): Row[] => {
    const rows = emptyRows();
    for (const r of batch.filter((b) => b.machine === m)) {
      const i = Number(r.batch_no) - 1;
      if (i >= 0 && i < rows.length) rows[i] = { real: r.real ?? "", paro: r.downtime_min?.toString() ?? "", kg: r.kg_melted?.toString() ?? "", peso: r.piece_kg?.toString() ?? "", pzs: r.pieces?.toString() ?? "", mer: r.merma_kg?.toString() ?? "" };
    }
    return rows;
  };
  const machineCalc = (m: "Tecnovac" | "Termo MK" | "Embolsado" | "Polar") =>
    compute(m, rowsOf(m), { ...cfg.batch[m], tolerance: cfg.tolerance });

  const tc = machineCalc("Tecnovac"), tr = tc.raw;
  const pedido = progByProc["Tecnovac"]?.qty ?? 0;
  const tRatio = tr.sPz > 0 ? ratio(tr.sPz, pedido) : null;
  const tecnoCard: CardData = { title: "Tecnovac", big: pct(tRatio), bigLabel: "Cumplimiento", st: sem(tRatio), tab: "mol",
    lines: tr.sKg > 0
      ? [{ a: "Batches a tiempo", b: tr.nTimed ? `${pct(tr.onT / tr.nTimed)} (${tr.onT} de ${tr.nTimed})` : "—" }, { a: "Rendimiento", b: pct(tr.sTm / tr.sKg) },
         { a: "Desecho", b: pct(tr.sDes / tr.sKg) },
         { a: tr.tg ? `Sobrepeso vs ${Math.round(tr.tg * 1000)} g` : "Sobrepeso", b: tr.tg && isFinite(tr.avgPeso) ? "+" + ((tr.avgPeso / tr.tg - 1) * 100).toFixed(1) + "%" : "—" }]
      : [{ a: "Sin captura", b: "" }],
    foot: pedido ? `Pedido ${n0(pedido)}${tr.sPz ? ` · empacado ${n0(tr.sPz)}` : ""}` : "Sin programa de empaque" };

  const others: CardData[] = MAQ.map(({ name, tab }) => {
    const c = machineCalc(name), pp = progByProc[name] ?? { qty: 0, n: 0 };
    const ratioM = c.raw.sPz > 0 ? ratio(c.raw.sPz, pp.qty) : null;
    return { title: name, big: pct(ratioM), bigLabel: "Cumplimiento", st: sem(ratioM), tab,
      lines: [{ a: "Programa de empaque", b: n0(pp.qty) + " pzs." }, { a: "Artículos con programa", b: String(pp.n) },
              { a: "Empacado", b: c.raw.sPz > 0 ? n0(c.raw.sPz) + " pzs." : "Sin captura" }], foot: "" };
  });

  const cards = [entCard, mvCard, tecnoCard, ...others];
  const part = (name: string, v: number | null) => (v == null ? `${name} sin captura` : `${name} ${pct(v)}`);
  const headline = [part("Multivac", mvRatio), deliv.length ? `entregas ${entCard.big} fill rate` : "sin registro de entregas", part("Tecnovac", tRatio)].join(" · ");

  return { day, days, headline, cards, month: await monthToDate(db, day, cfg) };
}

async function monthToDate(db: Db, day: string, _cfg: Config): Promise<{ a: string; b: string }[]> {
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
export { emptyHRows, computeHourly };
