// Dashboard mensual: valor de cada indicador por máquina y día (del 1 del mes al día elegido).
import { sql } from "./db";
import { loadConfig } from "./config-db";
import { MULTIVAC_IDS } from "./config";
import { computeHourly } from "./multivac";
import { hRowsOf } from "./detalle";
import { loadRaw, monthDays, summarizeDay } from "./tablero";

type Db = ReturnType<typeof sql>;
export const DASH_MACHINES = ["Tecnovac", "Multivac", "Termo MK", "Embolsado", "Polar"] as const;
export const DASH_INDICATORS = [
  { key: "ped", label: "Cumplimiento de pedido", kind: "r" }, { key: "rend", label: "Rendimiento", kind: "r" }, { key: "ot", label: "Batches a tiempo", kind: "r" },
  { key: "mer", label: "Merma", kind: "n" }, { key: "des", label: "Desecho", kind: "n" }, { key: "sob", label: "Sobrepeso", kind: "n" },
  { key: "meta", label: "Cumplimiento de meta", kind: "r" }, { key: "par", label: "Paro por MTO. (min)", kind: "n" },
] as const;
export type Dashboard = { day: string; days: string[]; machines: readonly string[]; indicators: typeof DASH_INDICATORS; values: (number | null)[][][]; note: string };

export async function loadDashboard(db: Db, day: string): Promise<Dashboard> {
  const cfg = await loadConfig(db);
  const days = monthDays(day);
  const raws = await loadRaw(db, days);
  // values[indicador][máquina][día]
  const values = DASH_INDICATORS.map(() => DASH_MACHINES.map(() => days.map((): number | null => null)));
  days.forEach((d, di) => {
    const S = summarizeDay(raws[d], cfg);
    DASH_MACHINES.forEach((m, mi) => {
      const set = (key: string, v: number | null) => { values[DASH_INDICATORS.findIndex((x) => x.key === key)][mi][di] = v != null && isFinite(v) ? v : null; };
      if (m === "Multivac") {
        const h = MULTIVAC_IDS.map((id) => computeHourly(hRowsOf(raws[d], id), cfg.hourly.starts, cfg.hourly.goals[id]).raw);
        const P = h.reduce((a, x) => a + x.P, 0), M = h.reduce((a, x) => a + x.M, 0), par = h.reduce((a, x) => a + x.par, 0);
        set("ped", S.mvRatio); set("meta", M > 0 ? P / M : null); set("par", S.mvDone.length || par ? par : null);
        return;
      }
      const mm = S.machines[m as "Tecnovac" | "Termo MK" | "Embolsado" | "Polar"], x = mm.c.raw;
      set("ped", mm.ratio);
      if (!mm.hasRows) return;
      set("rend", x.sKg > 0 ? x.sTm / x.sKg : null); set("ot", x.nTimed ? x.onT / x.nTimed : null);
      set("mer", x.sKg > 0 ? x.sMer / x.sKg : null); set("des", x.sKg > 0 ? x.sDes / x.sKg : null);
      set("sob", x.tg && isFinite(x.avgPeso) ? x.avgPeso / x.tg - 1 : null);
      set("meta", x.sMt ? x.sMp / x.sMt : null); set("par", x.sPar);
    });
  });
  return { day, days, machines: DASH_MACHINES, indicators: DASH_INDICATORS, values,
    note: "Solo hay valores en los días con captura o entregas; el resto aparece en blanco. Multivac no registra kilos, así que no tiene rendimiento, merma, desecho ni sobrepeso; su cumplimiento de meta es el de las franjas por hora." };
}
