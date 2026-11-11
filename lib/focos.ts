// Focos del día: alertas generadas automáticamente a partir de los datos reales, ordenadas por severidad.
import { sql } from "./db";
import { loadConfig } from "./config-db";
import { A, G, N, R, n0, pct, sem, type Sem } from "./domain";
import { MULTIVAC_IDS, MULTIVAC_NAMES } from "./config";
import { loadRaw, summarizeDay } from "./tablero";

type Db = ReturnType<typeof sql>;
export type Alert = { st: Sem; tag: string; h: string; m: string };
export type Focos = { day: string; headline: string; alerts: Alert[]; checks: string[] };
const short = (s: string) => { const t = String(s).trim().replace(/^\./, ""); return t.length > 30 ? t.slice(0, 30) + "…" : t; };
const sevOrder = (a: Alert) => (a.st === R ? 0 : a.st === A ? 1 : a.st === N ? 2 : 3);

export async function loadFocos(db: Db, day: string): Promise<Focos> {
  const cfg = await loadConfig(db);
  const S = summarizeDay((await loadRaw(db, [day]))[day], cfg);
  const out: Alert[] = [];

  // Entregas de PT
  if (S.hasDeliv) {
    const e = S.ent;
    if (e.vol != null && e.vol < 0.98) {
      const arts = await db`select id, description from articles`;
      const desc = new Map(arts.map((a) => [Number(a.id), String(a.description)]));
      const withFalt = [...new Set([...S.progEntById.keys(), ...S.delById.keys()])]
        .map((id) => ({ id, falt: Math.max((S.progEntById.get(id) ?? 0) - (S.delById.get(id) ?? 0), 0) }))
        .filter((x) => x.falt > 0).sort((a, b) => b.falt - a.falt);
      const short3 = withFalt.slice(0, 3);
      const share = e.falt > 0 ? short3.reduce((a, x) => a + x.falt, 0) / e.falt : 0;
      out.push({ st: sem(e.vol), tag: "Entregas CR100", h: `Cumplimiento ${pct(e.vol)}`,
        m: `Faltan ${n0(e.falt)} pzs (${e.full} de ${e.withProg} SKUs completos).` + (short3.length ? ` ${withFalt.length > 3 && share >= 0.6 ? `Tres SKUs explican el ${Math.round(share * 100)}%` : withFalt.length > 3 ? "Mayor faltante" : `Faltante en ${withFalt.length} SKU${withFalt.length === 1 ? "" : "s"}`}: ` + short3.map((x) => `${x.id} ${short(desc.get(x.id) ?? "")} (−${n0(x.falt)})`.replace(/\s+\(/, " (")).join(", ") + "." : "") });
    }
  } else if (S.progEnt > 0) out.push({ st: N, tag: "Entregas CR100", h: "Sin registro de entregas", m: `Hay programa de ${n0(S.progEnt)} pzs, pero no se ha capturado lo entregado.` });

  // Multivac
  for (const id of MULTIVAC_IDS) {
    const real = S.mvReal[id], prog = S.progMv[id] ?? 0;
    if (real != null && prog > 0) { const r = real / prog; if (r < 0.98) out.push({ st: sem(r), tag: "Multivac", h: `${MULTIVAC_NAMES[id]} al ${pct(r)}`, m: `${n0(real)} de ${n0(prog)} pzs programadas.` }); }
  }

  // Máquinas por batch
  const sinCaptura: string[] = [];
  for (const m of ["Tecnovac", "Termo MK", "Embolsado", "Polar"] as const) {
    const mm = S.machines[m];
    if (!mm.hasRows) { if (mm.prog.qty > 0) sinCaptura.push(m); continue; }
    const r = mm.ratio;
    if (r != null && r < 0.98) out.push({ st: sem(r), tag: m, h: `Cumplimiento ${pct(r)}`, m: `${n0(mm.real ?? 0)} de ${n0(mm.prog.qty)} pzs del programa.` });
    const x = mm.c.raw;
    if (x.nTimed >= 3 && x.onT / x.nTimed < 0.5) out.push({ st: A, tag: m, h: `Solo ${x.onT} de ${x.nTimed} batches a tiempo`, m: `Tolerancia de ${cfg.tolerance} min.` });
    if (x.sPar > 60) out.push({ st: A, tag: m, h: `Paro por mantenimiento de ${x.sPar} min`, m: "Acumulado de la jornada." });
    if (x.tg && isFinite(x.avgPeso) && x.avgPeso / x.tg - 1 > 0.05) out.push({ st: A, tag: m, h: `Sobrepeso +${((x.avgPeso / x.tg - 1) * 100).toFixed(1)}%`, m: `${(x.avgPeso * 1000).toFixed(0)} g por pieza contra ${Math.round(x.tg * 1000)} g.` });
    for (const w of mm.c.warns.filter((w) => w.s === R || w.s === A).slice(0, 1)) out.push({ st: w.s, tag: m, h: w.h.replace(/:$/, ""), m: w.m });
  }
  if (sinCaptura.length) out.push({ st: N, tag: "Captura", h: `Sin captura: ${sinCaptura.join(", ")}`, m: "Tienen programa de empaque pero no hay batches capturados." });

  const nR = out.filter((a) => a.st === R).length, nA = out.filter((a) => a.st === A).length;
  const hasData = S.hasDeliv || S.mvDone.length > 0 || Object.values(S.machines).some((m) => m.hasRows);
  if (hasData && nR + nA === 0) out.push({ st: G, tag: "General", h: "Sin focos", m: "Todo lo capturado está dentro de lo esperado." });
  out.sort((a, b) => sevOrder(a) - sevOrder(b));

  const headline = !hasData ? "Aún no hay captura ni entregas para esta jornada"
    : nR + nA === 0 ? "Sin focos rojos ni amarillos en la jornada"
    : `${nR} foco${nR === 1 ? "" : "s"} rojo${nR === 1 ? "" : "s"} y ${nA} amarillo${nA === 1 ? "" : "s"}: ${out.find((a) => a.st === R || a.st === A)!.tag} — ${out.find((a) => a.st === R || a.st === A)!.h.toLowerCase()}`;
  const checks = out.filter((a) => a.st === R || a.st === A).slice(0, 4).map((a) => (a.tag === "Entregas CR100" ? "Confirmar lo entregado de los SKUs con faltante" : `${a.tag}: ${a.h.charAt(0).toLowerCase() + a.h.slice(1)}, ¿causa y acción?`));
  if (!checks.length) checks.push("Sin pendientes por revisar");
  return { day, headline, alerts: out.slice(0, 14), checks };
}
