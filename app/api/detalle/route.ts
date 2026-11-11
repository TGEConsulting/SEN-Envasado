import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { fail } from "@/lib/http";
import { getSession } from "@/lib/auth";
import { loadDetalle } from "@/lib/detalle";
import { recentDays } from "@/lib/tablero";

const CAN_VIEW = ["Gerencia", "Supervisor", "Administrador"];
const TABS = ["ent", "ter", "mol", "mk", "embo", "vac"];
const isDay = (d: unknown): d is string => typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d) && !isNaN(Date.parse(d));

export async function GET(req: Request) {
  const s = await getSession();
  if (!s || !CAN_VIEW.includes(s.role)) return fail("No autorizado.", 403);
  const u = new URL(req.url), tab = u.searchParams.get("tab"), q = u.searchParams.get("day");
  if (!tab || !TABS.includes(tab)) return fail("Sección no válida.");
  const db = sql();
  const days = await recentDays(db);
  const day = isDay(q) ? q : days[days.length - 1] ?? new Date().toISOString().slice(0, 10);
  const product = parseInt(u.searchParams.get("product") ?? "", 10) || undefined;
  return NextResponse.json(await loadDetalle(db, tab, day, days, product));
}
