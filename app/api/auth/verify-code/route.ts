import { NextResponse } from "next/server";
import { body, fail } from "@/lib/http";
import { normEmail } from "@/lib/auth";
import { checkCode } from "@/lib/code-check";

export async function POST(req: Request) {
  const b = await body(req);
  const r = await checkCode(normEmail(b.email), String(b.code ?? ""));
  return r.ok ? NextResponse.json({ ok: true, role: r.role }) : fail(r.msg, 400);
}
