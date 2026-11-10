import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { fail } from "@/lib/http";
import { getSession } from "@/lib/auth";
import { REPORT_LIST, buildReport } from "@/lib/reportes";
import { CAN_VIEW_REPORTS, readParams } from "@/lib/report-params";

export async function GET(req: Request) {
  const s = await getSession();
  if (!s || !CAN_VIEW_REPORTS.includes(s.role)) return fail("No autorizado.", 403);
  const u = new URL(req.url), p = readParams(u), rep = u.searchParams.get("rep") ?? "";
  if (!p || !REPORT_LIST.some((r) => r.id === rep)) return fail("Reporte o fecha no válidos.");
  return NextResponse.json(await buildReport(sql(), rep, p));
}
