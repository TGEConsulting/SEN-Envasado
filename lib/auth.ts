import { createHash, createHmac, randomInt, scryptSync, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { sql } from "./db";
import type { Role } from "./domain";

const COOKIE = "sen_session";
const MAX_AGE = 60 * 60 * 12; // 12 h

function secret() {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) throw new Error("Falta SESSION_SECRET (mínimo 32 caracteres).");
  return s;
}
const b64 = (b: Buffer | string) => Buffer.from(b).toString("base64url");
const sig = (data: string) => createHmac("sha256", secret()).update(data).digest("base64url");

export const normEmail = (e: unknown) => String(e ?? "").trim().toLowerCase();
export const validEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) && e.length <= 254;

// ── contraseñas (scrypt) ──
export function hashPassword(pw: string) {
  const salt = randomBytes(16);
  return `scrypt$${salt.toString("base64")}$${scryptSync(pw, salt, 64).toString("base64")}`;
}
export function verifyPassword(pw: string, stored: string | null) {
  const [, s, h] = (stored ?? "scrypt$AAAAAAAAAAAAAAAAAAAAAA==$" + "A".repeat(86) + "==").split("$");
  const expected = Buffer.from(h, "base64");
  const got = scryptSync(pw, Buffer.from(s, "base64"), expected.length || 64);
  return !!stored && got.length === expected.length && timingSafeEqual(got, expected);
}
export const passwordRules = (pw: string) => [
  { ok: pw.length >= 8, t: "Al menos 8 caracteres" },
  { ok: /[A-Za-z]/.test(pw), t: "Una letra" },
  { ok: /\d/.test(pw), t: "Un número" },
];

// ── códigos de activación ──
export const newCode = () => String(randomInt(0, 1_000_000)).padStart(6, "0");
export const hashCode = (email: string, code: string) =>
  createHash("sha256").update(`${secret()}:${email}:${code}`).digest("hex");

// ── sesión ──
export type Session = { uid: number; email: string; role: Role };

export async function startSession(s: Session) {
  const payload = b64(JSON.stringify({ ...s, exp: Math.floor(Date.now() / 1000) + MAX_AGE }));
  (await cookies()).set(COOKIE, `${payload}.${sig(payload)}`, {
    httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: MAX_AGE,
  });
}
export async function endSession() {
  (await cookies()).delete(COOKIE);
}
// Lee la cookie y confirma contra la base que el usuario sigue activo y con el mismo rol.
export async function getSession(): Promise<Session | null> {
  const raw = (await cookies()).get(COOKIE)?.value;
  if (!raw) return null;
  const [payload, mac] = raw.split(".");
  if (!payload || !mac) return null;
  const a = Buffer.from(sig(payload)), b = Buffer.from(mac);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const p = JSON.parse(Buffer.from(payload, "base64url").toString());
    if (!p.exp || p.exp < Date.now() / 1000) return null;
    const rows = await sql()`select id, email, role from users where id = ${p.uid} and status = 'activo'`;
    if (!rows[0]) return null;
    return { uid: Number(rows[0].id), email: rows[0].email, role: rows[0].role as Role };
  } catch { return null; }
}
