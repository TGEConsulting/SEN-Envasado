import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { fail } from "@/lib/http";
import { getSession } from "@/lib/auth";
import { loadDashboard } from "@/lib/dashboard";
import { recentDays } from "@/lib/tablero";

const CAN_VIEW = ["Dirección", "Gerencia", "Administrador"];
const isDay = (d: unknown): d is string => typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d) && !isNaN(Date.parse(d));

export async function GET(req: Request) {
  const s = await getSession();
  if (!s || !CAN_VIEW.includes(s.role)) return fail("No autorizado.", 403);
  const db = sql(), q = new URL(req.url).searchParams.get("day");
  const days = await recentDays(db);
  const day = isDay(q) ? q : days[days.length - 1] ?? new Date().toISOString().slice(0, 10);
  return NextResponse.json(await loadDashboard(db, day));
}
