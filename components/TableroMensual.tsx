"use client";

import { useEffect, useState } from "react";
import type { Mensual } from "@/lib/mensual";

export default function TableroMensual({ day }: { day: string }) {
  const [d, setD] = useState<Mensual | null>(null);
  const [err, setErr] = useState("");
  useEffect(() => {
    let off = false;
    setD(null);
    (async () => {
      const r = await fetch(`/api/mensual?day=${day}`);
      if (off) return;
      if (!r.ok) return setErr("No se pudo cargar el tablero mensual.");
      setErr(""); setD(await r.json());
    })();
    return () => { off = true; };
  }, [day]);

  if (err) return <div role="alert" style={{ padding: 12, borderRadius: 10, background: "#fde3e8", color: "#9a0022" }}>{err}</div>;
  if (!d) return <div className="muted">Cargando…</div>;
  const grid = `minmax(140px,1.4fr) repeat(${d.labels.length},1fr)`;

  return (
    <>
      <div>
        <div style={{ fontSize: 12, marginBottom: 6, fontWeight: 600, color: "#0b6a9a", textTransform: "capitalize" }}>{d.title} · {d.range}</div>
        <h1 style={{ margin: 0, fontSize: 44, lineHeight: 1.05, color: "#0d4884" }}>Tablero mensual</h1>
      </div>
      <div className="grid-auto">
        {d.cards.map((c) => (
          <div key={c.title} className="blueprint" style={{ padding: 18, display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
              <span className="card-title">{c.title}</span>
              <span className="chip" style={{ background: c.st.t, color: c.st.i }}><span className="dot" style={{ background: c.st.c }} />{c.st.l}</span>
            </div>
            <div>
              <div style={{ fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: 56, lineHeight: 1 }}>{c.big}</div>
              <div className="muted" style={{ fontSize: 13, fontWeight: 500 }}>{c.bigLabel}</div>
            </div>
            <div>{c.lines.map((l) => (
              <div key={l.a} style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: 14, padding: "6px 0", borderTop: "1px solid #e3eaf2" }}>
                <span className="muted">{l.a}</span><strong style={{ fontWeight: 600 }}>{l.b}</strong></div>))}</div>
            <div className="muted" style={{ fontSize: 12 }}>{c.foot}</div>
          </div>
        ))}
      </div>
      <div className="blueprint" style={{ padding: 16, overflowX: "auto" }}>
        <div style={{ minWidth: 460, display: "flex", flexDirection: "column" }}>
          <div className="card-title" style={{ fontSize: 19, marginBottom: 8 }}>Jornadas con registro</div>
          <div className="muted" style={{ display: "grid", gridTemplateColumns: grid, gap: 6, paddingBottom: 8, fontSize: 12, fontWeight: 600 }}>
            <span />{d.labels.map((l) => <span key={l} style={{ textAlign: "center" }}>{l}</span>)}
          </div>
          {d.trend.map((r) => (
            <div key={r.group + r.label} style={{ display: "grid", gridTemplateColumns: grid, gap: 6, alignItems: "center", padding: "4px 0", borderTop: "1px solid #e3eaf2" }}>
              <span style={{ fontSize: 14 }}><span style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#0d4884" }}>{r.group}</span>{r.label}</span>
              {r.cells.map((c, i) => <span key={i} style={{ textAlign: "center", padding: "8px 0", fontSize: 14, fontWeight: 600, background: c.bg, color: c.ink }}>{c.t}</span>)}
            </div>
          ))}
        </div>
      </div>
      <div className="muted" style={{ fontSize: 12 }}>{d.note}</div>
    </>
  );
}
