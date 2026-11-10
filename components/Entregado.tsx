"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { n0, pct, sem } from "@/lib/domain";

type Row = { id: number; description: string; process: string; prog: number; delivered: number | null };
const lab: React.CSSProperties = { fontSize: 12, color: "var(--color-neutral-700)" };
const today = () => new Date().toISOString().slice(0, 10);

export default function Entregado({ day, onDay }: { day: string; onDay: (d: string) => void }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [edit, setEdit] = useState<Record<number, string>>({});
  const [canEdit, setCanEdit] = useState(false);
  const [msg, setMsg] = useState<{ t: string; bad?: boolean } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const r = await fetch(`/api/datos/entregado?day=${day}`);
    if (!r.ok) return setMsg({ t: "No se pudieron cargar las entregas.", bad: true });
    const j = await r.json();
    setRows(j.rows); setCanEdit(j.canEdit);
    setEdit(Object.fromEntries(j.rows.map((x: Row) => [x.id, x.delivered == null ? "" : String(x.delivered)])));
  }, [day]);
  useEffect(() => { load(); }, [load]);

  const calc = useMemo(() => rows.map((r) => {
    const v = edit[r.id] === "" || edit[r.id] == null ? null : Number(edit[r.id]);
    const ratio = v != null && r.prog > 0 ? v / r.prog : null;
    return { ...r, v, ratio, dirty: (v ?? null) !== r.delivered };
  }), [rows, edit]);

  const progTot = calc.reduce((a, r) => a + r.prog, 0), entTot = calc.reduce((a, r) => a + (r.v ?? 0), 0);
  const capped = calc.reduce((a, r) => a + Math.min(r.v ?? 0, r.prog), 0);
  const dirty = calc.filter((r) => r.dirty);

  async function save() {
    setBusy(true); setMsg(null);
    try {
      const r = await fetch("/api/datos/entregado", { method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ day, rows: dirty.map((x) => ({ id: x.id, qty: x.v })) }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) return setMsg({ t: j.error ?? "No se pudo guardar.", bad: true });
      setMsg({ t: `Guardado: ${j.saved} artículos${j.cleared ? ` y ${j.cleared} borrados` : ""}.` }); await load();
    } finally { setBusy(false); }
  }

  return (
    <>
      {msg && <div role="status" style={{ padding: 12, fontSize: 14, borderRadius: 10, background: msg.bad ? "#fde3e8" : "#e8f5d6", color: msg.bad ? "#9a0022" : "#2f5f0b" }}>{msg.t}</div>}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "flex-end" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}><label htmlFor="e-fecha" style={lab}>Fecha de entrega</label>
          <input id="e-fecha" className="input" type="date" value={day} style={{ width: "auto" }} onChange={(e) => e.target.value && onDay(e.target.value || today())} /></div>
        {canEdit && <button className="btn btn-primary" disabled={busy || !dirty.length} onClick={save}>Guardar</button>}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,180px),1fr))", gap: 16 }}>
        {[["Programado", n0(progTot) + " pzs."], ["Entregado", n0(entTot) + " pzs."], ["Fill rate", pct(progTot ? capped / progTot : null)]].map(([a, b]) => (
          <div key={a} className="blueprint" style={{ padding: 14 }}>
            <div className="muted" style={{ fontSize: 11, letterSpacing: ".08em", textTransform: "uppercase" }}>{a}</div>
            <div style={{ fontFamily: "var(--font-heading)", fontWeight: 600, fontSize: 34, lineHeight: 1.1 }}>{b}</div>
          </div>
        ))}
      </div>
      <div className="blueprint" style={{ padding: 16, overflowX: "auto" }}>
        <div className="card-title" style={{ fontSize: 19 }}>Producto entregado a embarques · contra programa de entregas</div>
        <table className="table" style={{ minWidth: 620, marginTop: 8 }}>
          <thead><tr><th>Artículo</th><th>Descripción</th><th>Proceso</th><th style={{ textAlign: "right" }}>Prog. entregas</th><th style={{ textAlign: "right" }}>Entregado (pzs)</th><th style={{ textAlign: "right" }}>Diferencia</th><th style={{ textAlign: "right" }}>%</th><th>Estado</th></tr></thead>
          <tbody>
            {calc.map((r) => { const st = sem(r.ratio); return (
              <tr key={r.id} style={{ background: r.dirty ? "#fff2cc" : undefined }}>
                <td>{r.id}</td><td>{r.description}</td><td>{r.process}</td><td style={{ textAlign: "right" }}>{n0(r.prog)}</td>
                <td style={{ textAlign: "right" }}><input className="input" inputMode="numeric" placeholder="0" disabled={!canEdit} style={{ width: 96, padding: "4px 6px", minHeight: 30, textAlign: "right" }}
                  value={edit[r.id] ?? ""} onChange={(e) => setEdit((p) => ({ ...p, [r.id]: e.target.value.replace(/[^\d]/g, "") }))} aria-label={`entregado ${r.id}`} /></td>
                <td style={{ textAlign: "right" }}>{r.v == null ? "—" : (r.v - r.prog > 0 ? "+" : "") + n0(r.v - r.prog)}</td>
                <td style={{ textAlign: "right", fontWeight: 600 }}>{pct(r.ratio)}</td>
                <td><span style={{ fontSize: 12, padding: "2px 8px", background: st.t, color: st.i }}>{st.l}</span></td>
              </tr>); })}
            {!calc.length && <tr><td colSpan={8} className="muted">No hay programa de entregas para esta fecha.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
