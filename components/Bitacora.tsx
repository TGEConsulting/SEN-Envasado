"use client";

import { useEffect, useState } from "react";

type L = { ts: string; usuario: string; program: string; day: string | null; article_id: number | null; description: string | null; old_value: string | null; new_value: string | null; reason: string };
const num = (v: string | null) => (v != null && v !== "" && isFinite(Number(v)) ? Number(v) : null);
const fmt = (v: string | null) => (num(v) != null ? Number(v).toLocaleString("en-US") : v ?? "—");
const diff = (a: string | null, b: string | null) => {
  const x = num(a), y = num(b);
  return x == null || y == null ? "—" : (y - x > 0 ? "+" : "") + (y - x).toLocaleString("en-US");
};

export default function Bitacora() {
  const [rows, setRows] = useState<L[]>([]);
  const [total, setTotal] = useState(0);
  const [q, setQ] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => {
    const t = setTimeout(async () => {
      const r = await fetch(`/api/bitacora?limit=300&q=${encodeURIComponent(q)}`);
      if (!r.ok) return setErr("No se pudo cargar la bitácora.");
      const j = await r.json(); setErr(""); setRows(j.rows); setTotal(j.total);
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  return (
    <>
      <div><div className="kicker">Auditoría</div><h1 style={{ margin: 0, fontSize: 44, lineHeight: 1.05 }}>Bitácora de programas</h1></div>
      {err && <div role="alert" style={{ padding: 12, fontSize: 14, borderRadius: 10, background: "#fde3e8", color: "#9a0022" }}>{err}</div>}
      <div style={{ display: "flex", flexDirection: "column", gap: 4, maxWidth: 420 }}>
        <label htmlFor="b-q" style={{ fontSize: 12, color: "var(--color-neutral-700)" }}>Buscar (usuario, programa, artículo o motivo)</label>
        <input id="b-q" className="input" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="blueprint" style={{ padding: 16, overflowX: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
          <div className="card-title" style={{ fontSize: 19 }}>Bitácora de cambios · programas y configuración</div>
          <span className="muted" style={{ fontSize: 12 }}>Mostrando {rows.length} de {total.toLocaleString("en-US")} · hora de Ciudad de México</span>
        </div>
        {rows.length === 0 ? (
          <div className="muted" style={{ fontSize: 14, padding: "8px 0" }}>
            {q ? "Sin resultados para esa búsqueda." : "Sin cambios registrados. Cada modificación guardada queda aquí con fecha, usuario, valor anterior, valor nuevo y motivo."}
          </div>
        ) : (
          <table className="table" style={{ minWidth: 820 }}>
            <thead><tr><th>Fecha y hora</th><th>Usuario</th><th>Programa</th><th>Artículo</th><th style={{ textAlign: "right" }}>Anterior</th><th style={{ textAlign: "right" }}>Nuevo</th><th style={{ textAlign: "right" }}>Cambio</th><th>Motivo</th></tr></thead>
            <tbody>
              {rows.map((l, i) => (
                <tr key={i}>
                  <td style={{ whiteSpace: "nowrap" }}>{l.ts}</td><td>{l.usuario}</td>
                  <td>{l.program}{l.day && <span style={{ display: "block", fontSize: 12 }} className="muted">Día {l.day}</span>}</td>
                  <td>{l.article_id ?? "—"}{l.description && <span style={{ display: "block", fontSize: 12 }} className="muted">{l.description}</span>}</td>
                  <td style={{ textAlign: "right" }}>{fmt(l.old_value)}</td><td style={{ textAlign: "right", fontWeight: 600 }}>{fmt(l.new_value)}</td>
                  <td style={{ textAlign: "right" }}>{diff(l.old_value, l.new_value)}</td><td>{l.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
