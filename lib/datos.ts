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

// ── Importación del libro: programa + real + inventario + datos del artículo ──
import type { ParsedProgram } from "./program-import";
export type ImportSummary = { days: string[]; programChanges: number; realChanges: number; invChanges: number; newArticles: string[] };

export async function applyImport(db: Db, p: ParsedProgram, o: { reason: string; userId: number | null; dry: boolean }): Promise<ImportSummary> {
  const days = p.days.map((d) => d.day);
  const [known, progs, packed, deliv, inv] = await Promise.all([
    db`select id from articles`,
    db`select to_char(day,'YYYY-MM-DD') as d, kind, article_id, qty from programs where day = any(${days}::date[])`,
    db`select to_char(day,'YYYY-MM-DD') as d, article_id, qty from packed where day = any(${days}::date[])`,
    db`select to_char(day,'YYYY-MM-DD') as d, article_id, qty from deliveries where day = any(${days}::date[])`,
    db`select to_char(day,'YYYY-MM-DD') as d, article_id, qty from inventory where day = any(${days}::date[])`,
  ]);
  const knownIds = new Set(known.map((r) => Number(r.id)));
  const key = (...a: (string | number)[]) => a.join("|");
  const oldProg = new Map(progs.map((r) => [key(r.d, r.kind, r.article_id), Number(r.qty)]));
  const oldP = new Map(packed.map((r) => [key(r.d, r.article_id), Number(r.qty)]));
  const oldD = new Map(deliv.map((r) => [key(r.d, r.article_id), Number(r.qty)]));
  const oldI = new Map(inv.map((r) => [key(r.d, r.article_id), Number(r.qty)]));

  const changes: Change[] = [];
  type R = { day: string; id: number; label: string; old: number | null; nw: number };
  const reals: { packed: R[]; deliv: R[]; inv: R[] } = { packed: [], deliv: [], inv: [] };
  const newArts: NewArticle[] = [], seenNew = new Set<number>();
  for (const d of p.days) for (const it of d.items) {
    if (!knownIds.has(it.id) && !seenNew.has(it.id)) { seenNew.add(it.id); newArts.push({ id: it.id, description: it.description || `Artículo ${it.id}`, process: defaultProcess(it.id) }); }
    for (const kind of ["empaque", "entregas"] as const) {
      const nw = it[kind], was = oldProg.get(key(d.day, kind, it.id)) ?? 0;
      if (nw !== was) changes.push({ day: d.day, kind, id: it.id, oldQty: was, newQty: nw });
    }
    const add = (list: R[], m: Map<string, number>, label: string, v: number | null) => {
      if (v == null) return; const was = m.get(key(d.day, it.id)) ?? null;
      if (was !== v) list.push({ day: d.day, id: it.id, label, old: was, nw: v });
    };
    add(reals.packed, oldP, "Real empaque", it.realE); add(reals.deliv, oldD, "Real entregas CR100", it.realG); add(reals.inv, oldI, "Inventario", it.inv);
  }
  const summary: ImportSummary = { days, programChanges: changes.length, realChanges: reals.packed.length + reals.deliv.length, invChanges: reals.inv.length, newArticles: newArts.map((a) => `${a.id} ${a.description}`) };
  if (o.dry) return summary;

  // datos del artículo (pesaje, fórmula, descripción corta y orden del catálogo)
  const meta = new Map<number, { pes: number | null; form: string | null }>();
  for (const d of p.days) for (const it of d.items) meta.set(it.id, { pes: it.pesaje ?? meta.get(it.id)?.pes ?? null, form: it.formula ?? meta.get(it.id)?.form ?? null });
  const ids = [...meta.keys()];
  const stmts = [];
  if (newArts.length) stmts.push(db`insert into articles (id, description, process)
      select * from unnest(${newArts.map((a) => a.id)}::int[], ${newArts.map((a) => a.description)}::text[], ${newArts.map((a) => a.process)}::text[]) on conflict (id) do nothing`);
  stmts.push(db`update articles a set pesaje = coalesce(t.pes, a.pesaje), formula = coalesce(t.form, a.formula), short_name = coalesce(t.short, a.short_name), ord = t.ord
      from unnest(${ids}::int[], ${ids.map((i) => meta.get(i)!.pes)}::numeric[], ${ids.map((i) => meta.get(i)!.form)}::text[], ${ids.map((i) => p.short[i] ?? null)}::text[], ${ids.map((i) => p.order.indexOf(i))}::int[]) as t(id, pes, form, short, ord)
      where a.id = t.id`);
  const ups = changes.filter((c) => c.newQty > 0), del = changes.filter((c) => c.newQty === 0);
  if (ups.length) stmts.push(db`insert into programs (day, kind, article_id, qty)
      select * from unnest(${ups.map((c) => c.day)}::date[], ${ups.map((c) => c.kind)}::text[], ${ups.map((c) => c.id)}::int[], ${ups.map((c) => c.newQty)}::int[])
      on conflict (day, kind, article_id) do update set qty = excluded.qty`);
  if (del.length) stmts.push(db`delete from programs p using unnest(${del.map((c) => c.day)}::date[], ${del.map((c) => c.kind)}::text[], ${del.map((c) => c.id)}::int[]) as t(day, kind, id)
      where p.day = t.day and p.kind = t.kind and p.article_id = t.id`);
  for (const [table, list] of [["packed", reals.packed], ["deliveries", reals.deliv], ["inventory", reals.inv]] as const) {
    if (!list.length) continue;
    const q = `insert into ${table} (day, article_id, qty) select * from unnest($1::date[], $2::int[], $3::int[]) on conflict (day, article_id) do update set qty = excluded.qty`;
    stmts.push(db.query(q, [list.map((r) => r.day), list.map((r) => r.id), list.map((r) => r.nw)]));
  }
  const label = (k: Kind) => (k === "empaque" ? "Programa de empaque" : "Programa de entregas");
  const log = [
    ...changes.map((c) => ({ prog: label(c.kind), day: c.day, id: c.id, old: String(c.oldQty), nw: String(c.newQty) })),
    ...[...reals.packed, ...reals.deliv, ...reals.inv].map((r) => ({ prog: r.label, day: r.day, id: r.id, old: r.old == null ? "—" : String(r.old), nw: String(r.nw) })),
  ];
  if (log.length) stmts.push(db`insert into audit_log (user_id, program, day, article_id, old_value, new_value, reason)
      select ${o.userId}::bigint, * , ${o.reason}::text from unnest(${log.map((l) => l.prog)}::text[], ${log.map((l) => l.day)}::date[], ${log.map((l) => l.id)}::int[], ${log.map((l) => l.old)}::text[], ${log.map((l) => l.nw)}::text[])`);
  await db.transaction(stmts);
  return summary;
}
