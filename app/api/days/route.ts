import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { fail } from "@/lib/http";
import { getSession } from "@/lib/auth";
import { recentDays } from "@/lib/tablero";

// Últimos días con información (programa, captura o entregas), para el selector de jornada.
export async function GET() {
  if (!(await getSession())) return fail("No autorizado.", 401);
  const days = await recentDays(sql());
  return NextResponse.json({ days: days.length ? days : [new Date().toISOString().slice(0, 10)] });
}
