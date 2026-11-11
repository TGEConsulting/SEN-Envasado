"use client";

import { useEffect, useState } from "react";
import { dayLong } from "@/lib/domain";
import type { Focos as F } from "@/lib/focos";

export default function Focos({ day }: { day: string }) {
  const [d, setD] = useState<F | null>(null);
  const [err, setErr] = useState("");
  const [done, setDone] = useState<Record<number, boolean>>({});
  const key = `sen-focos-${day}`;

  useEffect(() => {
    let off = false;
    setD(null);
    (async () => {
      const r = await fetch(`/api/focos?day=${day}`);
      if (off) return;
      if (!r.ok) return setErr("No se pudieron cargar los focos.");
      setErr(""); setD(await r.json());
    })();
    try { setDone(JSON.parse(localStorage.getItem(key) ?? "{}")); } catch { setDone({}); }
    return () => { off = true; };
  }, [day, key]);

  const toggle = (i: number) => setDone((p) => {
    const n = { ...p, [i]: !p[i] };
    try { localStorage.setItem(key, JSON.stringify(n)); } catch { /* sin almacenamiento: solo en pantalla */ }
    return n;
  });

  if (err) return <div role="alert" style={{ padding: 12, borderRadius: 10, background: "#fde3e8", color: "#9a0022" }}>{err}</div>;
  if (!d) return <div className="muted">Cargando…</div>;

  return (
    <div id="sen-report" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "flex-end", gap: 12 }}>
        <div>
          <div className="kicker">Jornada {dayLong(d.day)}</div>
          <h1 style={{ margin: 0, fontSize: 44, lineHeight: 1.05, maxWidth: 760, textWrap: "pretty" }}>{d.headline}</h1>
        </div>
        <button className="btn btn-secondary no-print" onClick={() => setTimeout(() => window.print(), 50)}>Exportar PDF</button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,300px),1fr))", gap: 16 }}>
        {d.alerts.length === 0 && <div className="blueprint" style={{ padding: 16 }}>Sin información para generar focos.</div>}
        {d.alerts.map((a, i) => (
          <div key={i} className="blueprint" style={{ padding: 16, display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={{ alignSelf: "flex-start", fontSize: 12, padding: "2px 8px", background: a.st.t, color: a.st.i, display: "inline-flex", gap: 6, alignItems: "center" }}>
              <span className="dot" style={{ background: a.st.c }} />{a.tag}
            </span>
            <strong style={{ fontWeight: 600, fontSize: 16 }}>{a.h}</strong>
            <span style={{ fontSize: 14, color: "var(--color-neutral-800)" }}>{a.m}</span>
          </div>
        ))}
      </div>

      <div className="blueprint" style={{ padding: 18 }}>
        <div className="card-title" style={{ marginBottom: 8 }}>Para la reunión</div>
        {d.checks.map((t, i) => (
          <label key={i} style={{ display: "flex", gap: 10, alignItems: "center", cursor: "pointer", fontSize: 15, padding: "8px 0", borderTop: "1px solid #e3eaf2" }}>
            <input type="checkbox" checked={!!done[i]} onChange={() => toggle(i)} style={{ accentColor: "#0d4884", width: 16, height: 16 }} />
            <span style={{ textDecoration: done[i] ? "line-through" : "none" }}>{t}</span>
          </label>
        ))}
        <div className="muted no-print" style={{ fontSize: 12, marginTop: 8 }}>Las marcas se guardan solo en este navegador.</div>
      </div>
    </div>
  );
}
