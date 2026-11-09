import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { body, fail } from "@/lib/http";
import { getSession } from "@/lib/auth";
import { HOURLY_PRODUCTS, HOUR_STARTS, emptyProducts, type HRow } from "@/lib/multivac";

const CAN_CAPTURE = ["Operador", "Supervisor", "Administrador"];
const IDS = HOURLY_PRODUCTS.map(([id]) => id);
const isDay = (d: unknown): d is string => typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d) && !isNaN(Date.parse(d));
const toInt = (s: unknown) => { const v = parseFloat(String(s ?? "").slice(0, 12)); return isFinite(v) ? Math.round(v) : null; };
const toTime = (s: unknown) => (/^\d{2}:\d{2}$/.test(String(s ?? "")) ? String(s) : null);
const str = (v: unknown, max = 120) => String(v ?? "").slice(0, max);

export async function GET(req: Request) {
  const s = await getSession();
  if (!s || !CAN_CAPTURE.includes(s.role)) return fail("No autorizado.", 403);
  const day = new URL(req.url).searchParams.get("day");
  if (!isDay(day)) return fail("Fecha no válida.");
  const db = sql();
  const [recs, sheets] = await Promise.all([
    db`select article_id, hour_idx, to_char(end_time,'HH24:MI') as end_time, pieces, stored, downtime_min, reel_changes, reel_change_min
       from hourly_records where day = ${day} order by article_id, hour_idx`,
    db`select team, leader, supervisor, signed_at from shift_sheets where day = ${day} and machine = 'Multivac' order by updated_at desc limit 1`,
  ]);
  const products = emptyProducts();
  for (const r of recs) {
    const id = Number(r.article_id), i = Number(r.hour_idx);
    if (products[id] && i >= 0 && i < HOUR_STARTS.length) products[id][i] = {
      fin: r.end_time ?? "", pzs: r.pieces?.toString() ?? "", alm: r.stored?.toString() ?? "",
      paro: r.downtime_min?.toString() ?? "", bob: r.reel_changes?.toString() ?? "", tcb: r.reel_change_min?.toString() ?? "",
    };
  }
  const sh = sheets[0];
  return NextResponse.json({ products, team: sh?.team ?? 1, leader: sh?.leader ?? "", supervisor: sh?.supervisor ?? "", signed: !!sh?.signed_at });
}

export async function PUT(req: Request) {
  const s = await getSession();
  if (!s || !CAN_CAPTURE.includes(s.role)) return fail("No autorizado.", 403);
  const b = await body(req);
  if (!isDay(b.day)) return fail("Fecha no válida.");
  const day = b.day, team = Number(b.team) === 2 ? 2 : 1, sign = b.sign === true, db = sql();
  const products = (b.products ?? {}) as Record<string, HRow[]>;

  const cur = await db`select 1 from shift_sheets where day = ${day} and machine = 'Multivac' and signed_at is not null limit 1`;
  if (cur[0] && s.role !== "Administrador") return fail("La hoja ya está firmada; solo un administrador puede modificarla.", 409);

  const inserts = IDS.flatMap((id) => (Array.isArray(products[id]) ? products[id].slice(0, HOUR_STARTS.length) : []).flatMap((r, i) => {
    const v = { fin: toTime(r?.fin), pzs: toInt(r?.pzs), alm: toInt(r?.alm), paro: toInt(r?.paro), bob: toInt(r?.bob), tcb: toInt(r?.tcb) };
    if (Object.values(v).every((x) => x == null)) return [];
    return [db`insert into hourly_records (day, article_id, hour_idx, end_time, pieces, stored, downtime_min, reel_changes, reel_change_min)
               values (${day}, ${id}, ${i}, ${v.fin}, ${v.pzs}, ${v.alm}, ${v.paro}, ${v.bob}, ${v.tcb})`];
  }));

  await db.transaction([
    db`delete from hourly_records where day = ${day} and article_id = any(${IDS})`,
    ...inserts,
    db`delete from shift_sheets where day = ${day} and machine = 'Multivac'`,
    db`insert into shift_sheets (day, machine, team, leader, supervisor, signed_by, signed_at, updated_at)
       values (${day}, 'Multivac', ${team}, ${str(b.leader)}, ${str(b.supervisor)}, ${sign ? s.uid : null}, ${sign ? new Date().toISOString() : null}, now())`,
  ]);
  return NextResponse.json({ ok: true, signed: sign });
}
