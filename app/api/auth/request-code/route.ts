import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { body, fail } from "@/lib/http";
import { hashCode, newCode, normEmail, validEmail } from "@/lib/auth";
import { sendActivationCode } from "@/lib/mail";

// Respuesta idéntica exista o no la invitación, para no revelar qué correos están invitados.
export async function POST(req: Request) {
  const email = normEmail((await body(req)).email);
  if (!validEmail(email)) return fail("Escribe un correo válido.");
  const db = sql();
  const rows = await db`select role from users where email = ${email} and status = 'invitado'`;
  let devCode: string | undefined;
  if (rows[0]) {
    const code = newCode();
    await db`insert into activation_codes (email, code_hash, expires_at, attempts)
             values (${email}, ${hashCode(email, code)}, now() + interval '15 minutes', 0)
             on conflict (email) do update set code_hash = excluded.code_hash, expires_at = excluded.expires_at, attempts = 0`;
    const { sent } = await sendActivationCode(email, rows[0].role, code);
    if (!sent && process.env.NODE_ENV !== "production") devCode = code; // solo desarrollo local
  }
  return NextResponse.json({ ok: true, devCode });
}
