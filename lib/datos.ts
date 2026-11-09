import { sql } from "./db";
import { defaultProcess, type Process } from "./domain";

export type Kind = "empaque" | "entregas";
export type Change = { day: string; kind: Kind; id: number; oldQty: number; newQty: number };
export type NewArticle = { id: number; description: string; process: Process };
export type ProcessChange = { id: number; oldProcess: string; newProcess: string };
type Db = ReturnType<typeof sql>;

// Aplica cambios de programa (y de proceso) en una sola transacción, con bitácora.
export async function applyChanges(db: Db, o: { changes: Change[]; articles?: NewArticle[]; processes?: ProcessChange[]; reason: string; userId: number | null }) {
  const ups = o.changes.filter((c) => c.newQty > 0), del = o.changes.filter((c) => c.newQty === 0);
  const arts = o.articles ?? [], procs = o.processes ?? [];
  const stmts = [];
  if (arts.length) stmts.push(db`insert into articles (id, description, process)
      select * from unnest(${arts.map((a) => a.id)}::int[], ${arts.map((a) => a.description)}::text[], ${arts.map((a) => a.process)}::text[])
      on conflict (id) do nothing`);
  if (procs.length) stmts.push(db`update articles a set process = t.p
      from unnest(${procs.map((p) => p.id)}::int[], ${procs.map((p) => p.newProcess)}::text[]) as t(id, p) where a.id = t.id`);
  if (ups.length) stmts.push(db`insert into programs (day, kind, article_id, qty)
      select * from unnest(${ups.map((c) => c.day)}::date[], ${ups.map((c) => c.kind)}::text[], ${ups.map((c) => c.id)}::int[], ${ups.map((c) => c.newQty)}::int[])
      on conflict (day, kind, article_id) do update set qty = excluded.qty`);
  if (del.length) stmts.push(db`delete from programs p using unnest(${del.map((c) => c.day)}::date[], ${del.map((c) => c.kind)}::text[], ${del.map((c) => c.id)}::int[]) as t(day, kind, id)
      where p.day = t.day and p.kind = t.kind and p.article_id = t.id`);
  const label = (k: Kind) => (k === "empaque" ? "Programa de empaque" : "Programa de entregas");
  const log = [
    ...o.changes.map((c) => ({ prog: label(c.kind), day: c.day, id: c.id, old: String(c.oldQty), nw: String(c.newQty) })),
    ...procs.map((p) => ({ prog: "Proceso del artículo", day: null as string | null, id: p.id, old: p.oldProcess, nw: p.newProcess })),
  ];
  if (log.length) stmts.push(db`insert into audit_log (user_id, program, day, article_id, old_value, new_value, reason)
      select ${o.userId}::bigint, * , ${o.reason}::text from unnest(${log.map((l) => l.prog)}::text[], ${log.map((l) => l.day)}::date[], ${log.map((l) => l.id)}::int[], ${log.map((l) => l.old)}::text[], ${log.map((l) => l.nw)}::text[])`);
  if (stmts.length) await db.transaction(stmts);
  return { changes: o.changes.length, processes: procs.length };
}
export { defaultProcess };
