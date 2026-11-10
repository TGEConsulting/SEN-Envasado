import { sql } from "@/lib/db";
import { fail } from "@/lib/http";
import { getSession } from "@/lib/auth";
import { REPORT_LIST, buildAll, buildReport } from "@/lib/reportes";
import { buildWorkbook } from "@/lib/xlsx";
import { CAN_VIEW_REPORTS, readParams } from "@/lib/report-params";

export const maxDuration = 60;

// ?all=1 → libro completo; si no, solo el reporte indicado.
export async function GET(req: Request) {
  const s = await getSession();
  if (!s || !CAN_VIEW_REPORTS.includes(s.role)) return fail("No autorizado.", 403);
  const u = new URL(req.url), p = readParams(u), rep = u.searchParams.get("rep") ?? "";
  const all = u.searchParams.get("all") === "1";
  if (!p || (!all && !REPORT_LIST.some((r) => r.id === rep))) return fail("Reporte o fecha no válidos.");
  const db = sql();
  const buf = await buildWorkbook(all ? await buildAll(db, p) : [await buildReport(db, rep, p)]);
  const name = `SEN_${all ? "libro" : rep}_${p.day}.xlsx`;
  return new Response(new Uint8Array(buf), {
    headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": `attachment; filename="${name}"`, "Cache-Control": "no-store" },
  });
}
