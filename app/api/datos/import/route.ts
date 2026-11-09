import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { fail } from "@/lib/http";
import { getSession } from "@/lib/auth";
import { parseProgram } from "@/lib/program-import";
import { applyChanges, defaultProcess, type Change, type NewArticle } from "@/lib/datos";

export const maxDuration = 60;

// Importa el programa de empaque y entregas de un libro de Excel. ?dry=1 solo calcula el resumen.
export async function POST(req: Request) {
  const s = await getSession();
  if (!s || !["Planeador", "Administrador"].includes(s.role)) return fail("No autorizado.", 403);
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return fail("Adjunta un archivo .xlsx.");
  if (!file.name.toLowerCase().endsWith(".xlsx") || file.size > 4_000_000) return fail("El archivo debe ser .xlsx de menos de 4 MB.");
  const parsed = await parseProgram(await file.arrayBuffer()).catch(() => null);
  if (!parsed) return fail("No se pudo leer el archivo.");
  if (!parsed.days.length) return fail("No se encontró ninguna hoja diaria con programa.");
  if (parsed.problems.length) return NextResponse.json({ error: "El archivo tiene errores.", problems: parsed.problems.slice(0, 20) }, { status: 422 });

  const db = sql();
  const known = await db`select id from articles`;
  const knownIds = new Set(known.map((r) => Number(r.id)));
  const days = parsed.days.map((d) => d.day);
  const cur = await db`select to_char(day,'YYYY-MM-DD') as day, kind, article_id, qty from programs where day = any(${days}::date[])`;
  const old = new Map(cur.map((r) => [`${r.day}|${r.kind}|${r.article_id}`, Number(r.qty)]));

  const changes: Change[] = [], articles: NewArticle[] = [], seenNew = new Set<number>();
  for (const d of parsed.days) for (const it of d.items) {
    if (!knownIds.has(it.id) && !seenNew.has(it.id)) { seenNew.add(it.id); articles.push({ id: it.id, description: it.description || `Artículo ${it.id}`, process: defaultProcess(it.id) }); }
    for (const kind of ["empaque", "entregas"] as const) {
      const nw = it[kind], was = old.get(`${d.day}|${kind}|${it.id}`) ?? 0;
      if (nw !== was) changes.push({ day: d.day, kind, id: it.id, oldQty: was, newQty: nw });
    }
  }
  const dry = new URL(req.url).searchParams.get("dry") === "1";
  if (!dry && (changes.length || articles.length)) await applyChanges(db, { changes, articles, reason: `Importación de ${file.name}`.slice(0, 300), userId: s.uid });
  return NextResponse.json({
    ok: true, dry, days, changes: changes.length, newArticles: articles.map((a) => `${a.id} ${a.description}`), skipped: parsed.skipped.length,
  });
}
