// Tablero mensual: acumulado del mes hasta el día elegido, calculado con los datos reales.
import { sql } from "./db";
import { loadConfig } from "./config-db";
import { N, monthLabel, n0, pct, sem } from "./domain";
import { MULTIVAC_IDS, MULTIVAC_NAMES } from "./config";
import { loadRaw, monthDays, ratio, summarizeDay, type CardData } from "./tablero";
import { loadTendencia, type Tendencia } from "./tendencia";

type Db = ReturnType<typeof sql>;
export type Mensual = { day: string; title: string; range: string; cards: CardData[]; trend: Tendencia["rows"]; labels: string[]; note: string };

export async function loadMensual(db: Db, day: string, days: string[]): Promise<Mensual> {
  const cfg = await loadConfig(db);
  const md = monthDays(day);
  const raws = await loadRaw(db, md);
  const S = md.map((d) => summarizeDay(raws[d], cfg));
  const card = (title: string, tab: CardData["tab"], r: number | null, bigLabel: string, lines: CardData["lines"], foot: string): CardData =>
    ({ title, big: pct(r), bigLabel, st: r == null ? N : sem(r), tab, lines, foot });

  // Entregas (días con entregas capturadas)
  const E = S.filter((s) => s.hasDeliv);
  const eProg = E.reduce((a, s) => a + s.progEnt, 0), eTot = E.reduce((a, s) => a + s.ent.tot, 0);
  const ent = E.length
    ? card("Entregas CR100", "ent", ratio(eTot, eProg), "Cumplimiento", [{ a: "Programa", b: n0(eProg) + " pzs." }, { a: "Real", b: n0(eTot) + " pzs." }, { a: "Faltante · excedente", b: `${n0(E.reduce((a, s) => a + s.ent.falt, 0))} · ${n0(E.reduce((a, s) => a + s.ent.exc, 0))}` }], `Real ÷ programa · ${E.length} jornada${E.length === 1 ? "" : "s"} con captura`)
    : card("Entregas CR100", "ent", null, "Cumplimiento", [{ a: "Sin registro de entregas en el mes", b: "" }], "");

  // Multivac (producto-día con captura)
  const per = MULTIVAC_IDS.map((id) => { const d = S.filter((s) => s.mvReal[id] != null); return { id, real: d.reduce((a, s) => a + (s.mvReal[id] as number), 0), prog: d.reduce((a, s) => a + (s.progMv[id] ?? 0), 0), n: d.length }; });
  const mvReal = per.reduce((a, x) => a + x.real, 0), mvProg = per.reduce((a, x) => a + x.prog, 0), mvDays = S.filter((s) => s.mvDone.length).length;
  const mv = card("Multivac", "ter", mvProg ? ratio(mvReal, mvProg) : null, "Cumplimiento", per.map((x) => ({ a: MULTIVAC_NAMES[x.id], b: x.prog ? pct(ratio(x.real, x.prog)) : "Sin captura" })),
    mvProg ? `Programa ${n0(mvProg)} · logrado ${n0(mvReal)} · ${mvDays} jornada${mvDays === 1 ? "" : "s"}` : "Sin captura en el mes");

  // Tecnovac (días con batches capturados)
  const T = S.filter((s) => s.machines.Tecnovac.hasRows), tr = T.map((s) => s.machines.Tecnovac.c.raw);
  const tPz = tr.reduce((a, x) => a + x.sPz, 0), tProg = T.reduce((a, s) => a + s.machines.Tecnovac.prog.qty, 0);
  const tKg = tr.reduce((a, x) => a + x.sKg, 0), tTm = tr.reduce((a, x) => a + x.sTm, 0), tDes = tr.reduce((a, x) => a + x.sDes, 0);
  const tN = tr.reduce((a, x) => a + x.nTimed, 0), tOn = tr.reduce((a, x) => a + x.onT, 0);
  const pesos = tr.filter((x) => x.tg && isFinite(x.avgPeso)).map((x) => x.avgPeso / x.tg - 1);
  const tec = T.length
    ? card("Tecnovac", "mol", tPz > 0 ? ratio(tPz, tProg) : null, "Cumplimiento",
        [{ a: "Batches a tiempo", b: tN ? pct(tOn / tN) : "—" }, { a: "Rendimiento", b: tKg ? pct(tTm / tKg) : "—" }, { a: "Desecho", b: tKg ? pct(tDes / tKg) : "—" },
         { a: "Sobrepeso", b: pesos.length ? "+" + ((pesos.reduce((a, v) => a + v, 0) / pesos.length) * 100).toFixed(1) + "%" : "—" }],
        `Pedido ${n0(tProg)} · empacado ${n0(tPz)} · ${T.length} jornada${T.length === 1 ? "" : "s"}`)
    : card("Tecnovac", "mol", null, "Cumplimiento", [{ a: "Sin captura en el mes", b: "" }], "");

  const others = (["Termo MK", "Embolsado", "Polar"] as const).map((m, i) => {
    const D = S.filter((s) => s.machines[m].real != null), pz = D.reduce((a, s) => a + (s.machines[m].real ?? 0), 0), pr = D.reduce((a, s) => a + s.machines[m].prog.qty, 0);
    return card(m, (["mk", "embo", "vac"] as const)[i], D.length && pz > 0 ? ratio(pz, pr) : null, "Cumplimiento",
      [{ a: "Programa de empaque", b: n0(pr) + " pzs." }, { a: "Empacado", b: pz > 0 ? n0(pz) + " pzs." : "Sin captura" }, { a: "Jornadas con registro", b: String(D.length) }], "");
  });

  const t = await loadTendencia(db, day, days);
  const trend = t.rows.filter((r) => (r.group === "Entregas CR100" && r.label === "Cumplimiento") || (r.group === "Empaque" && r.label === "Cumplimiento") || (r.group === "Multivac" && r.label === "Total") || (r.group === "Tecnovac" && r.label === "Cumplimiento"));
  return {
    day, title: monthLabel(day), range: `1 al ${Number(day.slice(8))}`, cards: [ent, mv, tec, ...others], trend, labels: t.labels,
    note: "Entregas y Multivac muestran el acumulado del mes sobre las jornadas con registro. Tecnovac y las demás máquinas se calculan sobre sus jornadas con captura.",
  };
}
