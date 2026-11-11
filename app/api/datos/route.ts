import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { body, fail } from "@/lib/http";
import { getSession } from "@/lib/auth";
import { PROCESSES } from "@/lib/domain";
import { applyChanges, type Change, type Kind, type ProcessChange } from "@/lib/datos";

const CAN_VIEW = ["Gerencia", "Planeador", "Administrador"];
const CAN_EDIT = ["Planeador", "Administrador"];
const isDay = (d: unknown): d is string => typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d) && !isNaN(Date.parse(d));
const isKind = (k: unknown): k is Kind => k === "empaque" || k === "entregas";

export async function GET(req: Request) {
  const s = await getSession();
  if (!s || !CAN_VIEW.includes(s.role)) return fail("No autorizado.", 403);
  const u = new URL(req.url), day = u.searchParams.get("day"), kind = u.searchParams.get("kind");
  if (!isDay(day) || !isKind(kind)) return fail("Fecha o programa no válidos.");
  const db = sql();
  const [rows, days] = await Promise.all([
    db`select a.id, a.description, a.process, coalesce(p.qty, 0) as qty
       from articles a left join programs p on p.article_id = a.id and p.day = ${day} and p.kind = ${kind} order by a.id`,
    db`select to_char(day,'YYYY-MM-DD') as day from programs where kind = ${kind} group by day having sum(qty) > 0 order by day`,
  ]);
  return NextResponse.json({
    rows: rows.map((r) => ({ id: Number(r.id), description: r.description, process: r.process, qty: Number(r.qty) })),
    days: days.map((d) => d.day), canEdit: CAN_EDIT.includes(s.role),
  });
}

export async function PUT(req: Request) {
  const s = await getSession();
  if (!s || !CAN_EDIT.includes(s.role)) return fail("No autorizado.", 403);
  const b = await body(req);
  if (!isDay(b.day) || !isKind(b.kind)) return fail("Fecha o programa no válidos.");
  const reason = String(b.reason ?? "").trim().slice(0, 300);
  const edits = Array.isArray(b.rows) ? (b.rows as { id: number; qty: number; process: string }[]) : [];
  const db = sql();
  const cur = await db`select a.id, a.process, coalesce(p.qty, 0) as qty from articles a
                       left join programs p on p.article_id = a.id and p.day = ${b.day} and p.kind = ${b.kind}`;
  const byId = new Map(cur.map((r) => [Number(r.id), r]));
  const changes: Change[] = [], processes: ProcessChange[] = [];
  for (const e of edits) {
    const old = byId.get(Number(e.id));
    if (!old) return fail(`Artículo ${e.id} no existe.`);
    const q = Number(e.qty);
    if (!Number.isInteger(q) || q < 0 || q > 10_000_000) return fail(`Cantidad no válida para el artículo ${e.id}.`);
    if (q !== Number(old.qty)) changes.push({ day: b.day, kind: b.kind, id: Number(e.id), oldQty: Number(old.qty), newQty: q });
    if (e.process !== old.process) {
      if (!(PROCESSES as string[]).includes(e.process)) return fail(`Proceso no válido para el artículo ${e.id}.`);
      processes.push({ id: Number(e.id), oldProcess: old.process, newProcess: e.process });
    }
  }
  if (!changes.length && !processes.length) return NextResponse.json({ ok: true, changes: 0, processes: 0 });
  if (!reason) return fail("Escribe el motivo del cambio.");
  const r = await applyChanges(db, { changes, processes, reason, userId: s.uid });
  return NextResponse.json({ ok: true, ...r });
}
