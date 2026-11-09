"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { PROCESSES, n0 } from "@/lib/domain";

type Kind = "empaque" | "entregas";
type Row = { id: number; description: string; process: string; qty: number };
const lab: React.CSSProperties = { fontSize: 12, color: "var(--color-neutral-700)" };
const today = () => new Date().toISOString().slice(0, 10);
const shortDay = (d: string) => new Date(d + "T00:00:00Z").toLocaleDateString("es-MX", { day: "2-digit", month: "short", timeZone: "UTC" });

export default function Datos({ role }: { role: string }) {
  const [kind, setKind] = useState<Kind>("empaque");
  const [day, setDay] = useState(today());
  const [orig, setOrig] = useState<Row[]>([]);
  const [edit, setEdit] = useState<Record<number, { qty: string; process: string }>>({});
  const [days, setDays] = useState<string[]>([]);
  const [canEdit, setCanEdit] = useState(false);
  const [reason, setReason] = useState("");
  const [q, setQ] = useState("");
  const [pf, setPf] = useState("all");
  const [hideZero, setHideZero] = useState(true);
  const [msg, setMsg] = useState<{ t: string; bad?: boolean } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const r = await fetch(`/api/datos?day=${day}&kind=${kind}`);
    if (!r.ok) return setMsg({ t: "No se pudieron cargar los datos.", bad: true });
    const j = await r.json();
    setOrig(j.rows); setDays(j.days); setCanEdit(j.canEdit);
    setEdit(Object.fromEntries(j.rows.map((x: Row) => [x.id, { qty: String(x.qty), process: x.process }])));
    setReason("");
  }, [day, kind]);
  useEffect(() => { load(); }, [load]);

  const changed = useMemo(() => orig.filter((o) => {
    const e = edit[o.id]; return e && (Number(e.qty || 0) !== o.qty || e.process !== o.process);
  }), [orig, edit]);

  const shown = orig.filter((o) => {
    const e = edit[o.id]; if (!e) return false;
    if (hideZero && Number(e.qty || 0) === 0 && o.qty === 0) return false;
    if (pf !== "all" && e.process !== pf) return false;
    const t = q.trim().toLowerCase();
    return !t || String(o.id).includes(t) || o.description.toLowerCase().includes(t);
  });
  const total = orig.reduce((a, o) => a + (Number(edit[o.id]?.qty) || 0), 0);
  const withProg = orig.filter((o) => Number(edit[o.id]?.qty) > 0).length;

  async function save() {
    setMsg(null);
    if (!reason.trim()) return setMsg({ t: "Escribe el motivo del cambio.", bad: true });
    for (const o of changed) { const v = Number(edit[o.id].qty); if (!Number.isInteger(v) || v < 0) return setMsg({ t: `Cantidad no válida en el artículo ${o.id}.`, bad: true }); }
    setBusy(true);
    try {
      const r = await fetch("/api/datos", { method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ day, kind, reason, rows: changed.map((o) => ({ id: o.id, qty: Number(edit[o.id].qty), process: edit[o.id].process })) }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) return setMsg({ t: j.error ?? "No se pudo guardar.", bad: true });
      setMsg({ t: `Guardado: ${j.changes} cambios de cantidad y ${j.processes} de proceso.` });
      await load();
    } finally { setBusy(false); }
  }

  async function importFile(f: File) {
    setMsg(null); setBusy(true);
    try {
      const fd = new FormData(); fd.append("file", f);
      const r = await fetch("/api/datos/import", { method: "POST", body: fd });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) return setMsg({ t: [j.error ?? "No se pudo importar.", ...(j.problems ?? [])].join(" "), bad: true });
      setMsg({ t: `Importados ${j.days.length} días (${j.changes} cambios${j.newArticles.length ? `; artículos nuevos: ${j.newArticles.join(", ")}` : ""}).` });
      await load();
    } finally { setBusy(false); }
  }

  const setE = (id: number, k: "qty" | "process", v: string) => setEdit((p) => ({ ...p, [id]: { ...p[id], [k]: v } }));
  const title = kind === "empaque" ? "Programa de empaque" : "Programa de entregas";

  return (
    <>
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "flex-end", gap: 12 }}>
        <div><div className="kicker">Entradas de datos</div><h1 style={{ margin: 0, fontSize: 44, lineHeight: 1.05 }}>{title}</h1></div>
        <div className="seg">
          {(["empaque", "entregas"] as Kind[]).map((k) => (
            <label key={k} className="seg-opt"><input type="radio" name="dt" checked={kind === k} onChange={() => setKind(k)} />{k === "empaque" ? "Prog. empaque" : "Prog. entregas"}</label>
          ))}
        </div>
      </div>

      {msg && <div role="status" style={{ padding: 12, fontSize: 14, borderRadius: 10, background: msg.bad ? "#fde3e8" : "#e8f5d6", color: msg.bad ? "#9a0022" : "#2f5f0b" }}>{msg.t}</div>}

      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "flex-end" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}><label htmlFor="d-fecha" style={lab}>Fecha del programa</label>
          <input id="d-fecha" className="input" type="date" value={day} onChange={(e) => e.target.value && setDay(e.target.value)} style={{ width: "auto" }} /></div>
        {changed.length > 0 && (
          <div style={{ flex: 1, minWidth: 220, display: "flex", flexDirection: "column", gap: 4 }}>
            <label htmlFor="d-motivo" style={lab}>Motivo del cambio · {changed.length} sin guardar (obligatorio)</label>
            <input id="d-motivo" className="input" placeholder="Ej. cambio de prioridad por pedido urgente" value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
        )}
        <div style={{ flex: 1, minWidth: 200, display: "flex", flexDirection: "column", gap: 4 }}><label htmlFor="d-q" style={lab}>Buscar artículo</label>
          <input id="d-q" className="input" placeholder="Número o descripción" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}><label htmlFor="d-pf" style={lab}>Proceso</label>
          <select id="d-pf" className="input" style={{ width: "auto" }} value={pf} onChange={(e) => setPf(e.target.value)}>
            <option value="all">Todos</option>{PROCESSES.map((p) => <option key={p}>{p}</option>)}</select></div>
        <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 14, paddingBottom: 8, cursor: "pointer" }}>
          <input type="checkbox" checked={hideZero} onChange={(e) => setHideZero(e.target.checked)} style={{ accentColor: "#0d4884", width: 16, height: 16 }} />Ocultar sin cantidad</label>
        {canEdit && <>
          <label className="btn btn-secondary" style={{ cursor: busy ? "wait" : "pointer" }}>Importar Excel
            <input type="file" accept=".xlsx" hidden disabled={busy} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) importFile(f); }} /></label>
          <button className="btn btn-primary" disabled={busy || !changed.length} onClick={save}>Guardar</button>
        </>}
      </div>

      {days.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center", fontSize: 13 }} className="muted">
          Días con programa:
          {days.map((d) => (
            <button key={d} onClick={() => setDay(d)} aria-pressed={d === day}
              style={{ cursor: "pointer", font: "inherit", fontSize: 13, padding: "3px 10px", borderRadius: 999, border: "1px solid #9fc6e8",
                background: d === day ? "#0d4884" : "#f6faff", color: d === day ? "#fff" : "#0d4884" }}>{shortDay(d)}</button>
          ))}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,180px),1fr))", gap: 16 }}>
        {[["Total programado", n0(total) + " pzs."], ["Artículos con programa", String(withProg)], ["Cambios sin guardar", String(changed.length)]].map(([a, b]) => (
          <div key={a} className="blueprint" style={{ padding: 14 }}>
            <div className="muted" style={{ fontSize: 11, letterSpacing: ".08em", textTransform: "uppercase" }}>{a}</div>
            <div style={{ fontFamily: "var(--font-heading)", fontWeight: 600, fontSize: 34, lineHeight: 1.1 }}>{b}</div>
          </div>
        ))}
      </div>

      <div className="blueprint" style={{ padding: 16, overflowX: "auto" }}>
        <div className="card-title" style={{ fontSize: 19 }}>{title} · {shortDay(day)}</div>
        <table className="table" style={{ minWidth: 520, marginTop: 8 }}>
          <thead><tr><th>Número de artículo</th><th>Descripción del artículo</th><th>Proceso</th><th style={{ textAlign: "right" }}>Cantidad</th></tr></thead>
          <tbody>
            {shown.map((o) => {
              const e = edit[o.id], dirty = Number(e.qty || 0) !== o.qty || e.process !== o.process;
              return (
                <tr key={o.id} style={{ background: dirty ? "#fff2cc" : undefined }}>
                  <td>{o.id}</td>
                  <td>{o.description}{dirty && <span style={{ display: "block", fontSize: 12, color: "var(--color-accent-700)" }}>Antes: {n0(o.qty)}{e.process !== o.process ? ` · ${o.process}` : ""}</span>}</td>
                  <td><select className="input" style={{ width: "auto", padding: "2px 6px", minHeight: 28 }} value={e.process} disabled={!canEdit}
                    onChange={(ev) => setE(o.id, "process", ev.target.value)} aria-label={`proceso ${o.id}`}>{PROCESSES.map((p) => <option key={p}>{p}</option>)}</select></td>
                  <td style={{ textAlign: "right" }}><input className="input" inputMode="numeric" style={{ width: 96, padding: "4px 6px", minHeight: 30, textAlign: "right" }}
                    value={e.qty} disabled={!canEdit} onChange={(ev) => setE(o.id, "qty", ev.target.value.replace(/[^\d]/g, ""))} aria-label={`cantidad ${o.id}`} /></td>
                </tr>
              );
            })}
            {!shown.length && <tr><td colSpan={4} className="muted">{orig.length ? "Sin artículos con esos filtros." : "Aún no hay artículos cargados. Importa el Excel del programa."}</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
