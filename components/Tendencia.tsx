"use client";

import { useEffect, useState } from "react";
import type { Tendencia as T } from "@/lib/tendencia";

export default function Tendencia({ day }: { day: string }) {
  const [d, setD] = useState<T | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    let off = false;
    setD(null);
    (async () => {
      const r = await fetch(`/api/tendencia?day=${day}`);
      if (off) return;
      if (!r.ok) return setErr("No se pudo cargar la tendencia.");
      setErr(""); setD(await r.json());
    })();
    return () => { off = true; };
  }, [day]);

  if (err) return <div role="alert" style={{ padding: 12, borderRadius: 10, background: "#fde3e8", color: "#9a0022" }}>{err}</div>;
  if (!d) return <div className="muted">Cargando…</div>;
  const grid = `minmax(150px,1.4fr) repeat(${d.labels.length},1fr)`;

  return (
    <>
      <div><div className="kicker">Últimos {d.labels.length} días con información</div><h1 style={{ margin: 0, fontSize: 44, lineHeight: 1.05 }}>Tendencia</h1></div>
      <div className="blueprint" style={{ padding: 16, overflowX: "auto" }}>
        <div style={{ minWidth: 520, display: "flex", flexDirection: "column" }}>
          <div style={{ display: "grid", gridTemplateColumns: grid, gap: 6, paddingBottom: 8, fontSize: 12, letterSpacing: ".08em", textTransform: "uppercase" }} className="muted">
            <span />{d.labels.map((l) => <span key={l} style={{ textAlign: "center" }}>{l}</span>)}
          </div>
          {d.rows.map((r) => (
            <div key={r.group + r.label} style={{ display: "grid", gridTemplateColumns: grid, gap: 6, alignItems: "center", padding: "4px 0", borderTop: "1px solid #e3eaf2" }}>
              <span style={{ fontSize: 14 }}><span style={{ display: "block", fontSize: 11, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--color-accent-700)" }}>{r.group}</span>{r.label}</span>
              {r.cells.map((c, i) => <span key={i} style={{ textAlign: "center", padding: "8px 0", fontSize: 14, fontWeight: 600, background: c.bg, color: c.ink }}>{c.t}</span>)}
            </div>
          ))}
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,200px),1fr))", gap: 16 }}>
        {d.month.map((m) => (
          <div key={m.a} className="blueprint" style={{ padding: 14 }}>
            <div className="muted" style={{ fontSize: 11, letterSpacing: ".08em", textTransform: "uppercase" }}>{m.a}</div>
            <div style={{ fontFamily: "var(--font-heading)", fontWeight: 600, fontSize: 34, lineHeight: 1.1 }}>{m.b}</div>
            <div className="muted" style={{ fontSize: 12 }}>{m.c}</div>
          </div>
        ))}
      </div>
    </>
  );
}
