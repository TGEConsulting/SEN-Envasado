// Lee el libro "Programa de empaque y entregas": una hoja por día (ddmmyy) con el programa
// de empaque (col. F) y de entregas (col. G). Se ignoran los reales (H, I) y las hojas de resumen.
import ExcelJS from "exceljs";

export type ProgramItem = { id: number; description: string; empaque: number; entregas: number };
export type ProgramDay = { day: string; items: ProgramItem[] };
export type ParsedProgram = { days: ProgramDay[]; skipped: string[]; problems: string[] };

const FIRST = 6, LAST = 48;
const cellNum = (v: unknown) => {
  const x = typeof v === "object" && v && "result" in v ? (v as { result: unknown }).result : v;
  return typeof x === "number" && isFinite(x) ? x : null;
};
const cellStr = (v: unknown) => {
  const x = typeof v === "object" && v && "result" in v ? (v as { result: unknown }).result : v;
  return typeof x === "string" ? x.trim() : x == null ? "" : String(x).trim();
};

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
  const out: ParsedProgram = { days: [], skipped: [], problems: [] };
  for (const ws of wb.worksheets) {
    const day = sheetDay(ws.name);
    if (!day) { out.skipped.push(ws.name); continue; }
    const h = (c: string) => cellStr(ws.getCell(c).value).toUpperCase();
    if (!h("B5").startsWith("NÚMERO DE ART") || h("F5") !== "EMPAQUE" || !h("G5").startsWith("ENTREGAS")) {
      out.problems.push(`${ws.name}: el encabezado no coincide (se esperaba Número de artículo / EMPAQUE / ENTREGAS).`);
      continue;
    }
    const items: ProgramItem[] = [], seen = new Set<number>();
    for (let r = FIRST; r <= LAST; r++) {
      const id = cellNum(ws.getCell(r, 2).value);
      if (id == null) continue;
      if (!Number.isInteger(id) || id <= 0) { out.problems.push(`${ws.name} fila ${r}: número de artículo no válido (${id}).`); continue; }
      if (seen.has(id)) { out.problems.push(`${ws.name} fila ${r}: artículo ${id} repetido.`); continue; }
      seen.add(id);
      const emp = cellNum(ws.getCell(r, 6).value) ?? 0, ent = cellNum(ws.getCell(r, 7).value) ?? 0;
      if (emp < 0 || ent < 0 || !Number.isInteger(emp) || !Number.isInteger(ent)) {
        out.problems.push(`${ws.name} fila ${r}: cantidad no válida (empaque ${emp}, entregas ${ent}).`); continue;
      }
      items.push({ id, description: cellStr(ws.getCell(r, 3).value).replace(/\s+/g, " "), empaque: emp, entregas: ent });
    }
    if (items.some((i) => i.empaque > 0 || i.entregas > 0)) out.days.push({ day, items });
    else out.skipped.push(`${ws.name} (sin programa)`);
  }
  return out;
}
