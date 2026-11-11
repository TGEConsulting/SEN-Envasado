import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { body, fail } from "@/lib/http";
import { normEmail, startSession, verifyPassword } from "@/lib/auth";
import type { Role } from "@/lib/domain";

export async function POST(req: Request) {
  const b = await body(req);
  const email = normEmail(b.email), pw = String(b.password ?? "");
  const rows = await sql()`select id, role, status, password_hash from users where email = ${email}`;
  const u = rows[0];
  const ok = verifyPassword(pw, u?.status === "activo" ? u.password_hash : null);
  if (!u || !ok) return fail("Correo o contraseña incorrectos.", 401);
  await startSession({ uid: Number(u.id), email, role: u.role as Role });
  return NextResponse.json({ ok: true });
}
