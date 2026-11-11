import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { body, fail } from "@/lib/http";
import { hashPassword, normEmail, passwordRules, startSession } from "@/lib/auth";
import { checkCode } from "@/lib/code-check";
import type { Role } from "@/lib/domain";

export async function POST(req: Request) {
  const b = await body(req);
  const email = normEmail(b.email), pw = String(b.password ?? "");
  if (!passwordRules(pw).every((r) => r.ok)) return fail("La contraseña no cumple las reglas.");
  const r = await checkCode(email, String(b.code ?? ""));
  if (!r.ok) return fail(r.msg);
  const db = sql();
  const rows = await db`update users set password_hash = ${hashPassword(pw)}, status = 'activo'
                        where email = ${email} and status = 'invitado' returning id`;
  if (!rows[0]) return fail("La invitación ya no está disponible.");
  await db`delete from activation_codes where email = ${email}`;
  await startSession({ uid: Number(rows[0].id), email, role: r.role as Role });
  return NextResponse.json({ ok: true });
}
