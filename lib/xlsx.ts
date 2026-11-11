import ExcelJS from "exceljs";
import type { ReportData } from "./reportes";

// Libro de Excel: título, subtítulo y la tabla con encabezado fijo.
export async function buildWorkbook(reports: ReportData[]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "SEN · Sistema de Envasado";
  const used = new Set<string>();
  for (const r of reports) {
    let name = r.sheet.replace(/[\\/*?:[\]]/g, " ").slice(0, 31) || "Hoja";
    for (let i = 2; used.has(name.toLowerCase()); i++) name = name.slice(0, 28) + " " + i;
    used.add(name.toLowerCase());
    const ws = wb.addWorksheet(name);
    ws.getCell("A1").value = r.name; ws.getCell("A1").font = { bold: true, size: 14 };
    ws.getCell("A2").value = r.sub; ws.getCell("A2").font = { color: { argb: "FF4F5B6D" } };
    const head = ws.getRow(4);
    r.head.forEach((h, i) => { const c = head.getCell(i + 1); c.value = h; c.font = { bold: true, color: { argb: "FF0D4884" } }; c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE6F0FA" } }; });
    r.rows.forEach((row) => ws.addRow(row));
    ws.views = [{ state: "frozen", ySplit: 4 }];
    r.head.forEach((h, i) => {
      const w = Math.max(h.length, ...r.rows.slice(0, 200).map((row) => String(row[i] ?? "").length));
      ws.getColumn(i + 1).width = Math.min(Math.max(w + 2, 10), 60);
    });
  }
  return Buffer.from(await wb.xlsx.writeBuffer());
}
