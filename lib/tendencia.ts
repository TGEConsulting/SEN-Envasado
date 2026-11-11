// Tendencia: indicadores de los últimos 5 días con semáforo, y acumulado del mes.
import { sql } from "./db";
import { loadConfig } from "./config-db";
import { dayChip, n0, pct, sem } from "./domain";
import { MULTIVAC_IDS, MULTIVAC_NAMES } from "./config";
import { loadRaw, ratio, summarizeDay } from "./tablero";

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
    row("Entregas PT", "Fill rate", (s) => (s.hasDeliv ? s.ent.fill : null)),
    row("Entregas PT", "Volumen", (s) => (s.hasDeliv ? s.ent.vol : null)),
    row("Multivac", "Total", (s) => s.mvRatio),
    ...MULTIVAC_IDS.map((id) => row("Multivac", MULTIVAC_NAMES[id], (s) => (s.mvReal[id] != null ? ratio(s.mvReal[id] as number, s.progMv[id] ?? 0) : null))),
    row("Tecnovac", "Cumplimiento", (s) => s.machines.Tecnovac.ratio),
    row("Tecnovac", "Rendimiento", (s) => (tec(s).sKg > 0 ? tec(s).sTm / tec(s).sKg : null)),
    row("Tecnovac", "Batches a tiempo", (s) => (tec(s).nTimed ? tec(s).onT / tec(s).nTimed : null)),
    row("Tecnovac", "Desecho", (s) => (tec(s).sKg > 0 ? tec(s).sDes / tec(s).sKg : null), "n"),
    row("Tecnovac", "Sobrepeso", (s) => (tec(s).tg && isFinite(tec(s).avgPeso) ? tec(s).avgPeso / tec(s).tg - 1 : null), "n", (x) => (x >= 0 ? "+" : "") + (x * 100).toFixed(1) + "%"),
    ...(["Termo MK", "Embolsado", "Polar"] as const).map((m) => row(m, "Cumplimiento", (s) => s.machines[m].ratio)),
  ];

  // acumulado del mes (hasta el día elegido), solo sobre días con captura / entregas
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
       select hd.article_id, sum(hd.real)::bigint as real,
              (select coalesce(sum(p.qty),0) from programs p where p.kind = 'empaque' and p.article_id = hd.article_id and p.day in (select day from hd h2 where h2.article_id = hd.article_id))::bigint as prog
       from hd group by hd.article_id`,
  ]);
  const prog = Number(del[0].prog), ent = Number(del[0].entregado), capped = Number(del[0].capped);
  const byId = new Map(mvr.map((r) => [Number(r.article_id), { real: Number(r.real), prog: Number(r.prog) }]));
  const mvReal = [...byId.values()].reduce((a, x) => a + x.real, 0), mvProg = [...byId.values()].reduce((a, x) => a + x.prog, 0);
  const month = [
    { a: "Entregas · volumen", b: prog ? pct(ratio(ent, prog)) : "—", c: prog ? `${n0(ent)} de ${n0(prog)} pzs.` : "Sin entregas en el mes" },
    { a: "Entregas · fill rate", b: prog ? pct(ratio(capped, prog)) : "—", c: "Mes a la fecha" },
    { a: "Multivac", b: mvProg ? pct(ratio(mvReal, mvProg)) : "—", c: mvProg ? `${n0(mvReal)} de ${n0(mvProg)} pzs.` : "Sin captura en el mes" },
    { a: "Multivac por producto", b: MULTIVAC_IDS.map((id) => (byId.get(id)?.prog ? (((byId.get(id)!.real / byId.get(id)!.prog) * 100).toFixed(1) + "%") : "—")).join(" · "), c: MULTIVAC_IDS.map((id) => MULTIVAC_NAMES[id].split(" ")[0]).join(" · ") },
  ];
  return { day, labels: all.map(dayChip), rows, month };
}
