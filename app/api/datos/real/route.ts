import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { body, fail } from "@/lib/http";
import { getSession } from "@/lib/auth";
import { loadCatalog } from "@/lib/periodo-db";

const CAN_VIEW = ["Gerencia", "Supervisor", "Planeador", "Administrador"];
const CAN_EDIT = ["Supervisor", "Planeador", "Administrador"];
const isDay = (d: unknown): d is string => typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d) && !isNaN(Date.parse(d));

// Real del día por artículo (TOTAL EMPAQUE, TOTAL ENTREGAS CR100 e inventario) contra el programa.
export async function GET(req: Request) {
  const s = await getSession();
  if (!s || !CAN_VIEW.includes(s.role)) return fail("No autorizado.", 403);
  const day = new URL(req.url).searchParams.get("day");
  if (!isDay(day)) return fail("Fecha no válida.");
  const db = sql();
  const [catalog, procs, progs, packed, deliv, inv] = await Promise.all([
    loadCatalog(db), db`select id, process from articles`,
    db`select kind, article_id, qty from programs where day = ${day}::date`,
    db`select article_id, qty from packed where day = ${day}::date`,
    db`select article_id, qty from deliveries where day = ${day}::date`,
    db`select article_id, qty from inventory where day = ${day}::date`,
  ]);
  const proc = new Map(procs.map((p) => [Number(p.id), String(p.process)]));
  const pe = new Map<number, number>(), pg = new Map<number, number>();
  for (const r of progs) (r.kind === "empaque" ? pe : pg).set(Number(r.article_id), Number(r.qty));
  const m = (rows: Record<string, unknown>[]) => new Map(rows.map((r) => [Number(r.article_id), Number(r.qty)] as [number, number]));
  const pk = m(packed), dv = m(deliv), iv = m(inv);
  return NextResponse.json({
    rows: catalog.map((a) => ({ id: a.id, description: a.description, short: a.short, pesaje: a.pesaje, process: proc.get(a.id) ?? "", progE: pe.get(a.id) ?? 0, progG: pg.get(a.id) ?? 0, realE: pk.get(a.id) ?? null, realG: dv.get(a.id) ?? null, inv: iv.get(a.id) ?? null })),
    canEdit: CAN_EDIT.includes(s.role),
  });
}

type Edit = { id: number; realE?: number | null; realG?: number | null; inv?: number | null };
export async function PUT(req: Request) {
  const s = await getSession();
  if (!s || !CAN_EDIT.includes(s.role)) return fail("No autorizado.", 403);
  const b = await body(req);
  if (!isDay(b.day)) return fail("Fecha no válida.");
  const day = b.day, edits = Array.isArray(b.rows) ? (b.rows as Edit[]) : [];
  const db = sql();
  const known = new Set((await db`select id from articles`).map((r) => Number(r.id)));
  const fields = [["realE", "packed", "Real empaque"], ["realG", "deliveries", "Real entregas CR100"], ["inv", "inventory", "Inventario"]] as const;
  type Op = { table: string; label: string; id: number; qty: number | null };
  const ops: Op[] = [];
  for (const e of edits) {
    const id = Number(e.id);
    if (!known.has(id)) return fail(`Artículo ${e.id} no existe.`);
    for (const [k, table, label] of fields) {
      if (!(k in e)) continue;
      const v = e[k];
      if (v === null) { ops.push({ table, label, id, qty: null }); continue; }
      const q = Number(v);
      if (!Number.isInteger(q) || q < 0 || q > 10_000_000) return fail(`${label}: cantidad no válida en el artículo ${id}.`);
      ops.push({ table, label, id, qty: q });
    }
  }
  if (!ops.length) return NextResponse.json({ ok: true, saved: 0, cleared: 0 });
  // valores actuales para la bitácora
  const cur = new Map<string, number>();
  for (const [, table] of fields) for (const r of await db.query(`select article_id, qty from ${table} where day = $1::date`, [day])) cur.set(`${table}|${r.article_id}`, Number(r.qty));
  const stmts = [], log: { prog: string; id: number; old: string; nw: string }[] = [];
  for (const [, table, label] of fields) {
    const mine = ops.filter((o) => o.table === table);
    const set = mine.filter((o) => o.qty !== null), clr = mine.filter((o) => o.qty === null);
    if (set.length) stmts.push(db.query(`insert into ${table} (day, article_id, qty) select $1::date, * from unnest($2::int[], $3::int[]) on conflict (day, article_id) do update set qty = excluded.qty`, [day, set.map((o) => o.id), set.map((o) => o.qty)]));
    if (clr.length) stmts.push(db.query(`delete from ${table} where day = $1::date and article_id = any($2::int[])`, [day, clr.map((o) => o.id)]));
    for (const o of mine) { const old = cur.get(`${table}|${o.id}`); if ((old ?? null) !== o.qty) log.push({ prog: label, id: o.id, old: old == null ? "—" : String(old), nw: o.qty == null ? "—" : String(o.qty) }); }
  }
  if (log.length) stmts.push(db`insert into audit_log (user_id, program, day, article_id, old_value, new_value, reason)
      select ${s.uid}::bigint, t.p, ${day}::date, t.a, t.o, t.n, 'Captura de real del día' from unnest(${log.map((l) => l.prog)}::text[], ${log.map((l) => l.id)}::int[], ${log.map((l) => l.old)}::text[], ${log.map((l) => l.nw)}::text[]) as t(p, a, o, n)`);
  if (stmts.length) await db.transaction(stmts);
  return NextResponse.json({ ok: true, saved: ops.filter((o) => o.qty !== null).length, cleared: ops.filter((o) => o.qty === null).length });
}
