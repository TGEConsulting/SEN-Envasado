import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { body, fail } from "@/lib/http";
import { getSession } from "@/lib/auth";
import { BATCH_MACHINES, N_BATCHES, emptyRows, type Row } from "@/lib/capture";

const CAN_CAPTURE = ["Operador", "Supervisor", "Administrador"];
const isDay = (d: unknown): d is string => typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d) && !isNaN(Date.parse(d));
const isMachine = (m: unknown): m is string => (BATCH_MACHINES as readonly string[]).includes(String(m));
const toNum = (s: string) => { const v = parseFloat(s); return isFinite(v) ? v : null; };
const toTime = (s: string) => (/^\d{2}:\d{2}$/.test(s) ? s : null);
const str = (v: unknown, max = 120) => String(v ?? "").slice(0, max);

export async function GET(req: Request) {
  const s = await getSession();
  if (!s || !CAN_CAPTURE.includes(s.role)) return fail("No autorizado.", 403);
  const u = new URL(req.url), day = u.searchParams.get("day"), machine = u.searchParams.get("machine");
  if (!isDay(day) || !isMachine(machine)) return fail("Fecha o máquina no válidas.");
  const db = sql();
  const [recs, sheets] = await Promise.all([
    db`select batch_no, to_char(real_time,'HH24:MI') as real_time, downtime_min, kg_melted, piece_kg, pieces, merma_kg
       from batch_records where day = ${day} and machine = ${machine} order by batch_no`,
    db`select team, leader, supervisor, signed_at from shift_sheets where day = ${day} and machine = ${machine} order by updated_at desc limit 1`,
  ]);
  const rows = emptyRows();
  for (const r of recs) {
    const i = Number(r.batch_no) - 1;
    if (i >= 0 && i < N_BATCHES) rows[i] = {
      real: r.real_time ?? "", paro: r.downtime_min?.toString() ?? "", kg: r.kg_melted?.toString() ?? "",
      peso: r.piece_kg?.toString() ?? "", pzs: r.pieces?.toString() ?? "", mer: r.merma_kg?.toString() ?? "",
    };
  }
  const sh = sheets[0];
  return NextResponse.json({
    rows, team: sh?.team ?? 1, leader: sh?.leader ?? "", supervisor: sh?.supervisor ?? "", signed: !!sh?.signed_at,
  });
}

export async function PUT(req: Request) {
  const s = await getSession();
  if (!s || !CAN_CAPTURE.includes(s.role)) return fail("No autorizado.", 403);
  const b = await body(req);
  if (!isDay(b.day) || !isMachine(b.machine)) return fail("Fecha o máquina no válidas.");
  const team = Number(b.team) === 2 ? 2 : 1, sign = b.sign === true;
  const rows = Array.isArray(b.rows) ? (b.rows as Row[]).slice(0, N_BATCHES) : [];
  const day = b.day, machine = b.machine, db = sql();

  const cur = await db`select signed_at from shift_sheets where day = ${day} and machine = ${machine} and signed_at is not null limit 1`;
  if (cur[0] && s.role !== "Administrador") return fail("La hoja ya está firmada; solo un administrador puede modificarla.", 409);

  await db.transaction([
    db`delete from batch_records where day = ${day} and machine = ${machine}`,
    ...rows.flatMap((r, i) => {
      const v = { real: toTime(str(r?.real, 5)), paro: toNum(str(r?.paro, 10)), kg: toNum(str(r?.kg, 12)), peso: toNum(str(r?.peso, 12)), pzs: toNum(str(r?.pzs, 12)), mer: toNum(str(r?.mer, 12)) };
      if (Object.values(v).every((x) => x == null)) return [];
      return [db`insert into batch_records (day, machine, batch_no, real_time, downtime_min, kg_melted, piece_kg, pieces, merma_kg)
                 values (${day}, ${machine}, ${i + 1}, ${v.real}, ${v.paro == null ? null : Math.round(v.paro)}, ${v.kg}, ${v.peso}, ${v.pzs == null ? null : Math.round(v.pzs)}, ${v.mer})`];
    }),
    db`delete from shift_sheets where day = ${day} and machine = ${machine}`,
    db`insert into shift_sheets (day, machine, team, leader, supervisor, signed_by, signed_at, updated_at)
       values (${day}, ${machine}, ${team}, ${str(b.leader)}, ${str(b.supervisor)}, ${sign ? s.uid : null}, ${sign ? new Date().toISOString() : null}, now())`,
  ]);
  return NextResponse.json({ ok: true, signed: sign });
}
