import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { body, fail } from "@/lib/http";
import { getSession } from "@/lib/auth";

const CAN_VIEW = ["Gerencia", "Supervisor", "Planeador", "Administrador"];
const CAN_EDIT = ["Supervisor", "Planeador", "Administrador"];
const isDay = (d: unknown): d is string => typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d) && !isNaN(Date.parse(d));

// Producto entregado a embarques contra el programa de entregas del día.
export async function GET(req: Request) {
  const s = await getSession();
  if (!s || !CAN_VIEW.includes(s.role)) return fail("No autorizado.", 403);
  const day = new URL(req.url).searchParams.get("day");
  if (!isDay(day)) return fail("Fecha no válida.");
  const rows = await sql()`
    select a.id, a.description, a.process, coalesce(p.qty, 0) as prog, d.qty as delivered
    from articles a
    left join programs p on p.article_id = a.id and p.day = ${day} and p.kind = 'entregas'
    left join deliveries d on d.article_id = a.id and d.day = ${day}
    where coalesce(p.qty, 0) > 0 or d.qty is not null order by a.id`;
  return NextResponse.json({
    rows: rows.map((r) => ({ id: Number(r.id), description: r.description, process: r.process, prog: Number(r.prog), delivered: r.delivered == null ? null : Number(r.delivered) })),
    canEdit: CAN_EDIT.includes(s.role),
  });
}

export async function PUT(req: Request) {
  const s = await getSession();
  if (!s || !CAN_EDIT.includes(s.role)) return fail("No autorizado.", 403);
  const b = await body(req);
  if (!isDay(b.day)) return fail("Fecha no válida.");
  const rows = Array.isArray(b.rows) ? (b.rows as { id: number; qty: number | null }[]) : [];
  const set: { id: number; qty: number }[] = [], clear: number[] = [];
  for (const r of rows) {
    const id = Number(r.id);
    if (!Number.isInteger(id)) return fail("Artículo no válido.");
    if (r.qty === null) { clear.push(id); continue; }
    const q = Number(r.qty);
    if (!Number.isInteger(q) || q < 0 || q > 10_000_000) return fail(`Cantidad no válida para el artículo ${id}.`);
    set.push({ id, qty: q });
  }
  const db = sql(), day = b.day;
  const known = await db`select id from articles where id = any(${[...set.map((x) => x.id), ...clear]}::int[])`;
  if (known.length !== new Set([...set.map((x) => x.id), ...clear]).size) return fail("Hay artículos que no existen.");
  const stmts = [];
  if (set.length) stmts.push(db`insert into deliveries (day, article_id, qty)
      select ${day}::date, * from unnest(${set.map((x) => x.id)}::int[], ${set.map((x) => x.qty)}::int[])
      on conflict (day, article_id) do update set qty = excluded.qty`);
  if (clear.length) stmts.push(db`delete from deliveries where day = ${day}::date and article_id = any(${clear}::int[])`);
  if (stmts.length) await db.transaction(stmts);
  return NextResponse.json({ ok: true, saved: set.length, cleared: clear.length });
}
