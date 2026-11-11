import { NextResponse } from "next/server";
export const fail = (msg: string, status = 400) => NextResponse.json({ error: msg }, { status });
export const body = async (req: Request) => { try { return (await req.json()) as Record<string, unknown>; } catch { return {}; } };
