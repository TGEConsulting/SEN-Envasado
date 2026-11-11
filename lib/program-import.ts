// Lee el libro «Programa de empaque y entregas»: una hoja por día (ddmmyy) con el programa
// (F, G), el real (H, I), el inventario (P), el pesaje (D) y la fórmula/origen (E).
// Las hojas de resumen y Pareto se recalculan en la app, así que se ignoran.
import ExcelJS from "exceljs";

export type ProgramItem = {
  id: number; description: string; pesaje: number | null; formula: string | null;
  empaque: number; entregas: number; realE: number | null; realG: number | null; inv: number | null;
};
export type ProgramDay = { day: string; items: ProgramItem[] };
export type ParsedProgram = { days: ProgramDay[]; order: number[]; short: Record<number, string>; skipped: string[]; problems: string[] };

const FIRST = 6, LAST = 48;
const raw = (v: unknown) => (typeof v === "object" && v && "result" in v ? (v as { result: unknown }).result : v);
const cellNum = (v: unknown) => { const x = raw(v); return typeof x === "number" && isFinite(x) ? x : null; };
const cellStr = (v: unknown) => { const x = raw(v); return typeof x === "string" ? x.trim() : x == null ? "" : String(x).trim(); };

export function sheetDay(name: string): string | null {
  const m = /^(\d{2})(\d{2})(\d{2})$/.exec(name);
  if (!m) return null;
  const iso = `20${m[3]}-${m[2]}-${m[1]}`;
  const d = new Date(iso + "T00:00:00Z");
  return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === iso ? iso : null;
}

export async function parseProgram(data: ArrayBuffer | Buffer): Promise<ParsedProgram> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(data as ArrayBuffer);
  const out: ParsedProgram = { days: [], order: [], short: {}, skipped: [], problems: [] };
  // descripciones cortas (hoja oculta «Chart Data»: artículo en D, descripción corta en E)
  const cd = wb.getWorksheet("Chart Data");
  if (cd) for (let r = 2; r <= 60; r++) { const id = cellNum(cd.getCell(r, 4).value), s = cellStr(cd.getCell(r, 5).value); if (id != null && s) out.short[id] = s; }
  for (const ws of wb.worksheets) {
    const day = sheetDay(ws.name);
    if (!day) { out.skipped.push(ws.name); continue; }
    const h = (c: string) => cellStr(ws.getCell(c).value).toUpperCase();
    if (!h("B5").startsWith("NÚMERO DE ART") || h("F5") !== "EMPAQUE" || !h("G5").startsWith("ENTREGAS") || !h("H5").startsWith("TOTAL EMPAQUE") || !h("I5").startsWith("TOTAL ENTREGAS")) {
      out.problems.push(`${ws.name}: el encabezado no coincide (Número de artículo / EMPAQUE / ENTREGAS / TOTAL EMPAQUE / TOTAL ENTREGAS).`);
      continue;
    }
    const items: ProgramItem[] = [], seen = new Set<number>();
    let numeric = 0;
    for (let r = FIRST; r <= LAST; r++) {
      const id = cellNum(ws.getCell(r, 2).value);
      if (id == null) continue;
      if (!Number.isInteger(id) || id <= 0) { out.problems.push(`${ws.name} fila ${r}: número de artículo no válido (${id}).`); continue; }
      if (seen.has(id)) { out.problems.push(`${ws.name} fila ${r}: artículo ${id} repetido.`); continue; }
      seen.add(id);
      const f = cellNum(ws.getCell(r, 6).value), g = cellNum(ws.getCell(r, 7).value), rh = cellNum(ws.getCell(r, 8).value), ri = cellNum(ws.getCell(r, 9).value), inv = cellNum(ws.getCell(r, 16).value);
      numeric += [f, g, rh, ri].filter((x) => x != null).length;
      for (const [n, v] of [["empaque", f], ["entregas", g], ["real de empaque", rh], ["real de entregas", ri]] as const)
        if (v != null && (v < 0 || !Number.isInteger(v))) out.problems.push(`${ws.name} fila ${r}: ${n} no válido (${v}).`);
      if (inv != null && !Number.isInteger(inv)) out.problems.push(`${ws.name} fila ${r}: inventario no válido (${inv}).`);
      const pes = cellNum(ws.getCell(r, 4).value), form = cellStr(ws.getCell(r, 5).value);
      items.push({ id, description: cellStr(ws.getCell(r, 3).value).replace(/\s+/g, " "), pesaje: pes != null && pes > 0 ? pes : null, formula: form || null, empaque: f ?? 0, entregas: g ?? 0, realE: rh, realG: ri, inv });
      if (!out.order.includes(id)) out.order.push(id);
    }
    // «Con captura» = hay algún número en F:I (igual que el libro).
    if (numeric > 0) out.days.push({ day, items }); else out.skipped.push(`${ws.name} (sin captura)`);
  }
  return out;
}
