import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { body, fail } from "@/lib/http";
import { getSession, normEmail, validEmail } from "@/lib/auth";
import { ROLES } from "@/lib/domain";

async function admin() {
  const s = await getSession();
  return s?.role === "Administrador" ? s : null;
}

export async function GET() {
  if (!(await admin())) return fail("No autorizado.", 403);
  const rows = await sql()`select id, email, role, status from users order by created_at`;
  return NextResponse.json({ users: rows });
}

export async function POST(req: Request) {
  if (!(await admin())) return fail("No autorizado.", 403);
  const b = await body(req);
  const email = normEmail(b.email), role = String(b.role ?? "");
  if (!validEmail(email)) return fail("Escribe un correo válido.");
  if (!(role in ROLES)) return fail("Rol no válido.");
  const rows = await sql()`insert into users (email, role) values (${email}, ${role}) on conflict (email) do nothing returning id`;
  return rows[0] ? NextResponse.json({ ok: true }) : fail("Ese correo ya tiene una invitación o cuenta.", 409);
}

export async function DELETE(req: Request) {
  const s = await admin();
  if (!s) return fail("No autorizado.", 403);
  const id = Number(new URL(req.url).searchParams.get("id"));
  if (!Number.isInteger(id)) return fail("Usuario no válido.");
  if (id === s.uid) return fail("No puedes quitarte a ti mismo.");
  await sql()`delete from users where id = ${id}`;
  return NextResponse.json({ ok: true });
}
