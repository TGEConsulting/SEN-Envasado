import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { fail } from "@/lib/http";
import { getSession } from "@/lib/auth";
import { parseProgram } from "@/lib/program-import";
import { applyImport } from "@/lib/datos";

export const maxDuration = 60;

// Importa el libro «Programa de empaque y entregas»: programa, real, inventario y datos del artículo.
// ?dry=1 solo calcula el resumen de cambios.
export async function POST(req: Request) {
  const s = await getSession();
  if (!s || !["Planeador", "Administrador"].includes(s.role)) return fail("No autorizado.", 403);
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return fail("Adjunta un archivo .xlsx.");
  if (!file.name.toLowerCase().endsWith(".xlsx") || file.size > 4_000_000) return fail("El archivo debe ser .xlsx de menos de 4 MB.");
  const parsed = await parseProgram(await file.arrayBuffer()).catch(() => null);
  if (!parsed) return fail("No se pudo leer el archivo.");
  if (!parsed.days.length) return fail("No se encontró ninguna hoja diaria con captura.");
  if (parsed.problems.length) return NextResponse.json({ error: "El archivo tiene errores.", problems: parsed.problems.slice(0, 20) }, { status: 422 });
  const dry = new URL(req.url).searchParams.get("dry") === "1";
  const r = await applyImport(sql(), parsed, { reason: `Importación de ${file.name}`.slice(0, 300), userId: s.uid, dry });
  return NextResponse.json({ ok: true, dry, ...r, skipped: parsed.skipped.length });
}
