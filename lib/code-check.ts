import { sql } from "./db";
import { hashCode } from "./auth";

// Valida el código (máx. 5 intentos, 15 min). Devuelve el rol de la invitación si es correcto.
export async function checkCode(email: string, code: string): Promise<{ ok: true; role: string } | { ok: false; msg: string }> {
  const db = sql();
  const rows = await db`select code_hash, expires_at, attempts from activation_codes where email = ${email}`;
  const r = rows[0];
  const bad = { ok: false as const, msg: "Código incorrecto o vencido. Pide uno nuevo." };
  if (!r || new Date(r.expires_at) < new Date() || r.attempts >= 5) return bad;
  if (r.code_hash !== hashCode(email, code)) {
    await db`update activation_codes set attempts = attempts + 1 where email = ${email}`;
    return bad;
  }
  const u = await db`select role from users where email = ${email} and status = 'invitado'`;
  return u[0] ? { ok: true, role: u[0].role } : bad;
}
