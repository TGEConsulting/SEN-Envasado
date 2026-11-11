import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { fail } from "@/lib/http";
import { getSession } from "@/lib/auth";

const CAN_VIEW = ["Dirección", "Gerencia", "Administrador"];

export async function GET(req: Request) {
  const s = await getSession();
  if (!s || !CAN_VIEW.includes(s.role)) return fail("No autorizado.", 403);
  const u = new URL(req.url);
  const q = (u.searchParams.get("q") ?? "").trim().slice(0, 80);
  const limit = Math.min(Math.max(parseInt(u.searchParams.get("limit") ?? "200", 10) || 200, 1), 1000);
  const like = `%${q.replace(/[%_\\]/g, "\\$&")}%`;
  const rows = await sql()`
    select to_char(l.at at time zone 'America/Mexico_City', 'DD/MM/YYYY HH24:MI') as ts, coalesce(u.email, 'Sistema') as usuario,
           l.program, to_char(l.day, 'YYYY-MM-DD') as day, l.article_id, a.description, l.old_value, l.new_value, l.reason
    from audit_log l left join users u on u.id = l.user_id left join articles a on a.id = l.article_id
    where ${q === ""} or l.program ilike ${like} or l.reason ilike ${like} or coalesce(u.email, '') ilike ${like}
          or coalesce(a.description, '') ilike ${like} or l.article_id::text = ${q}
    order by l.at desc, l.id desc limit ${limit}`;
  const total = await sql()`select count(*)::int as n from audit_log`;
  return NextResponse.json({ rows, total: total[0].n });
}
