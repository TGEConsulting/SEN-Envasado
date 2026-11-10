import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { body, fail } from "@/lib/http";
import { getSession } from "@/lib/auth";
import { diffConfig, parseConfig } from "@/lib/config";
import { loadConfig } from "@/lib/config-db";

const CAN_EDIT = ["Gerencia", "Administrador"];

export async function GET() {
  const s = await getSession();
  if (!s || !CAN_EDIT.includes(s.role)) return fail("No autorizado.", 403);
  return NextResponse.json({ config: await loadConfig() });
}

export async function PUT(req: Request) {
  const s = await getSession();
  if (!s || !CAN_EDIT.includes(s.role)) return fail("No autorizado.", 403);
  const b = await body(req);
  const parsed = parseConfig(b.config);
  if (!parsed.ok) return fail(parsed.msg);
  const reason = String(b.reason ?? "").trim().slice(0, 300);
  const db = sql();
  const current = await loadConfig(db);
  const changes = diffConfig(current, parsed.cfg);
  if (!changes.length) return NextResponse.json({ ok: true, changes: 0 });
  if (!reason) return fail("Escribe el motivo del cambio.");
  await db.transaction([
    db`insert into settings (key, value, updated_at) values ('config', ${JSON.stringify(parsed.cfg)}::jsonb, now())
       on conflict (key) do update set value = excluded.value, updated_at = excluded.updated_at`,
    db`insert into audit_log (user_id, program, old_value, new_value, reason)
       select ${s.uid}::bigint, * , ${reason}::text
       from unnest(${changes.map((c) => c.program)}::text[], ${changes.map((c) => c.old)}::text[], ${changes.map((c) => c.nw)}::text[])`,
  ]);
  return NextResponse.json({ ok: true, changes: changes.length });
}
