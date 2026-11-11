"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { n0, pct, sem } from "@/lib/domain";

type Row = { id: number; description: string; short: string | null; pesaje: number | null; process: string; progE: number; progG: number; realE: number | null; realG: number | null; inv: number | null };
type Ed = { realE: string; realG: string; inv: string };
const lab: React.CSSProperties = { fontSize: 12, color: "var(--color-neutral-700)" };
const toS = (v: number | null) => (v == null ? "" : String(v));
const toN = (s: string) => (s.trim() === "" ? null : Number(s));
const cellInput: React.CSSProperties = { width: 92, padding: "4px 6px", minHeight: 30, textAlign: "right" };

export default function RealDia({ day, onDay }: { day: string; onDay: (d: string) => void }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [edit, setEdit] = useState<Record<number, Ed>>({});
  const [canEdit, setCanEdit] = useState(false);
  const [q, setQ] = useState("");
  const [hide, setHide] = useState(true);
  const [msg, setMsg] = useState<{ t: string; bad?: boolean } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const r = await fetch(`/api/datos/real?day=${day}`);
    if (!r.ok) return setMsg({ t: "No se pudo cargar el real del día.", bad: true });
    const j = await r.json();
    setRows(j.rows); setCanEdit(j.canEdit);
    setEdit(Object.fromEntries(j.rows.map((x: Row) => [x.id, { realE: toS(x.realE), realG: toS(x.realG), inv: toS(x.inv) }])));
  }, [day]);
  useEffect(() => { load(); }, [load]);

  const calc = useMemo(() => rows.map((r) => {
    const e = edit[r.id] ?? { realE: "", realG: "", inv: "" }, rE = toN(e.realE), rG = toN(e.realG);
    return { ...r, e, rE, rG, cE: rE != null && r.progE > 0 ? rE / r.progE : null, cG: rG != null && r.progG > 0 ? rG / r.progG : null,
      dirty: toN(e.realE) !== r.realE || toN(e.realG) !== r.realG || toN(e.inv) !== r.inv };
  }), [rows, edit]);

  const sum = (f: (r: (typeof calc)[number]) => number) => calc.reduce((a, r) => a + f(r), 0);
  const pE = sum((r) => r.progE), rE = sum((r) => r.rE ?? 0), pG = sum((r) => r.progG), rG = sum((r) => r.rG ?? 0);
  const kgE = sum((r) => (r.rE ?? 0) * (r.pesaje ?? 0)), kgG = sum((r) => (r.rG ?? 0) * (r.pesaje ?? 0));
  const dirty = calc.filter((r) => r.dirty);
  const shown = calc.filter((r) => {
    if (hide && r.progE === 0 && r.progG === 0 && r.rE == null && r.rG == null && r.dirty === false) return false;
    const t = q.trim().toLowerCase();
    return !t || String(r.id).includes(t) || r.description.toLowerCase().includes(t) || (r.short ?? "").toLowerCase().includes(t);
  });

  async function save() {
    for (const r of dirty) for (const v of [r.e.realE, r.e.realG, r.e.inv]) if (v.trim() !== "" && !/^\d+$/.test(v.trim())) return setMsg({ t: `Hay una cantidad no válida en el artículo ${r.id}.`, bad: true });
    setBusy(true); setMsg(null);
    try {
      const body = { day, rows: dirty.map((r) => ({ id: r.id, ...(toN(r.e.realE) !== r.realE ? { realE: toN(r.e.realE) } : {}), ...(toN(r.e.realG) !== r.realG ? { realG: toN(r.e.realG) } : {}), ...(toN(r.e.inv) !== r.inv ? { inv: toN(r.e.inv) } : {}) })) };
      const r = await fetch("/api/datos/real", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) return setMsg({ t: j.error ?? "No se pudo guardar.", bad: true });
      setMsg({ t: `Guardado: ${j.saved} valores${j.cleared ? ` y ${j.cleared} borrados` : ""}.` }); await load();
    } finally { setBusy(false); }
  }

  const pill = (r: number | null) => { const s = sem(r); return <span style={{ fontSize: 12, padding: "2px 8px", background: s.t, color: s.i, whiteSpace: "nowrap" }}>{pct(r)}</span>; };
  const setE = (id: number, k: keyof Ed, v: string) => setEdit((p) => ({ ...p, [id]: { ...p[id], [k]: v.replace(/[^\d]/g, "") } }));

  return (
    <>
      {msg && <div role="status" style={{ padding: 12, fontSize: 14, borderRadius: 10, background: msg.bad ? "#fde3e8" : "#e8f5d6", color: msg.bad ? "#9a0022" : "#2f5f0b" }}>{msg.t}</div>}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "flex-end" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}><label htmlFor="r-fecha" style={lab}>Fecha</label>
          <input id="r-fecha" className="input" type="date" value={day} style={{ width: "auto" }} onChange={(e) => e.target.value && onDay(e.target.value)} /></div>
        <div style={{ flex: 1, minWidth: 200, display: "flex", flexDirection: "column", gap: 4 }}><label htmlFor="r-q" style={lab}>Buscar artículo</label>
          <input id="r-q" className="input" placeholder="Número o descripción" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 14, paddingBottom: 8, cursor: "pointer" }}>
          <input type="checkbox" checked={hide} onChange={(e) => setHide(e.target.checked)} style={{ accentColor: "#0d4884", width: 16, height: 16 }} />Ocultar sin programa ni real</label>
        {canEdit && <button className="btn btn-primary" disabled={busy || !dirty.length} onClick={save}>Guardar</button>}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,190px),1fr))", gap: 16 }}>
        {[["Empaque · cumplimiento", pct(pE ? rE / pE : null), `${n0(rE)} de ${n0(pE)} pzs. · ${n0(kgE)} kg`], ["Entregas · cumplimiento", pct(pG ? rG / pG : null), `${n0(rG)} de ${n0(pG)} pzs. · ${n0(kgG)} kg`]].map(([a, b, c]) => (
          <div key={a} className="blueprint" style={{ padding: 14 }}>
            <div className="muted" style={{ fontSize: 11, letterSpacing: ".08em", textTransform: "uppercase" }}>{a}</div>
            <div style={{ fontFamily: "var(--font-heading)", fontWeight: 600, fontSize: 34, lineHeight: 1.1 }}>{b}</div>
            <div className="muted" style={{ fontSize: 12 }}>{c}</div>
          </div>))}
      </div>
      <div className="blueprint" style={{ padding: 16, overflowX: "auto" }}>
        <div className="card-title" style={{ fontSize: 19 }}>Real del día contra programa</div>
        <div className="muted" style={{ fontSize: 12, margin: "2px 0 8px" }}>Real = total empaque y total entregas CR100. Kilos = piezas × pesaje. Sin semáforo cuando el programa es cero.</div>
        <table className="table" style={{ minWidth: 900 }}>
          <thead><tr><th>Artículo</th><th>Descripción</th><th style={{ textAlign: "right" }}>Prog. empaque</th><th style={{ textAlign: "right" }}>Real empaque</th><th style={{ textAlign: "right" }}>%</th>
            <th style={{ textAlign: "right" }}>Prog. entregas</th><th style={{ textAlign: "right" }}>Real entregas</th><th style={{ textAlign: "right" }}>%</th><th style={{ textAlign: "right" }}>Inventario</th></tr></thead>
          <tbody>
            {shown.map((r) => (
              <tr key={r.id} style={{ background: r.dirty ? "#fff2cc" : undefined }}>
                <td>{r.id}</td><td>{r.description}</td>
                <td style={{ textAlign: "right" }}>{n0(r.progE)}</td>
                <td style={{ textAlign: "right" }}><input className="input" inputMode="numeric" style={cellInput} disabled={!canEdit} value={r.e.realE} onChange={(ev) => setE(r.id, "realE", ev.target.value)} aria-label={`real empaque ${r.id}`} /></td>
                <td style={{ textAlign: "right" }}>{pill(r.cE)}</td>
                <td style={{ textAlign: "right" }}>{n0(r.progG)}</td>
                <td style={{ textAlign: "right" }}><input className="input" inputMode="numeric" style={cellInput} disabled={!canEdit} value={r.e.realG} onChange={(ev) => setE(r.id, "realG", ev.target.value)} aria-label={`real entregas ${r.id}`} /></td>
                <td style={{ textAlign: "right" }}>{pill(r.cG)}</td>
                <td style={{ textAlign: "right" }}><input className="input" inputMode="numeric" style={cellInput} disabled={!canEdit} value={r.e.inv} onChange={(ev) => setE(r.id, "inv", ev.target.value)} aria-label={`inventario ${r.id}`} /></td>
              </tr>))}
            {!shown.length && <tr><td colSpan={9} className="muted">Sin artículos para mostrar. Importa el Excel del programa en Prog. empaque.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
