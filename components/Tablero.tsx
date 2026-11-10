"use client";

import { useEffect, useState } from "react";
import { A, G, R, dayLong, monthStartLabel, type TabId } from "@/lib/domain";
import type { TableroData } from "@/lib/tablero";
import TableroMensual from "./TableroMensual";
import Dashboard from "./Dashboard";

export type Mode = "dia" | "mes" | "dash";

export default function Tablero({ day, mode, onMode, canOpen, onOpen }: { day: string; mode: Mode; onMode: (m: Mode) => void; canOpen: (t: TabId) => boolean; onOpen: (t: TabId) => void }) {
  const [data, setData] = useState<TableroData | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (mode !== "dia") return;
    let off = false;
    (async () => {
      const r = await fetch(`/api/tablero?day=${day}`);
      if (off) return;
      if (!r.ok) return setErr("No se pudo cargar el tablero.");
      const j: TableroData = await r.json();
      setErr(""); setData(j);
    })();
    return () => { off = true; };
  }, [day, mode]);

  const toggle = (
    <div className="seg no-print" style={{ alignSelf: "flex-start" }}>
      {([["dia", "Tablero del día"], ["mes", "Tablero mensual"], ["dash", "Dashboard"]] as [Mode, string][]).map(([m, t]) => (
        <label key={m} className="seg-opt"><input type="radio" name="tmode" checked={mode === m} onChange={() => onMode(m)} />{t}</label>
      ))}
    </div>
  );
  if (mode === "mes") return <>{toggle}<TableroMensual day={day} /></>;
  if (mode === "dash") return <>{toggle}<Dashboard day={day} /></>;

  if (err) return <div role="alert" style={{ padding: 12, borderRadius: 10, background: "#fde3e8", color: "#9a0022" }}>{err}</div>;
  if (!data) return <div className="muted">Cargando tablero…</div>;

  return (
    <>
      {toggle}
      <div>
        <div className="kicker">Jornada {dayLong(data.day)}</div>
        <h1 style={{ margin: 0, fontSize: 44, lineHeight: 1.05, maxWidth: 900, textWrap: "pretty" }}>{data.headline}</h1>
      </div>

      <div className="grid-auto">
        {data.cards.map((c) => {
          const open = canOpen(c.tab as TabId);
          return (
            <div key={c.title} className="blueprint" role={open ? "button" : undefined} tabIndex={open ? 0 : undefined}
              onClick={open ? () => onOpen(c.tab as TabId) : undefined}
              onKeyDown={open ? (ev) => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); onOpen(c.tab as TabId); } } : undefined}
              style={{ padding: 18, display: "flex", flexDirection: "column", gap: 12, cursor: open ? "pointer" : "default" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                <span className="card-title">{c.title}</span>
                <span className="chip" style={{ background: c.st.t, color: c.st.i }}>
                  <span className="dot" style={{ background: c.st.c }} />{c.st.l}
                </span>
              </div>
              <div>
                <div style={{ fontFamily: "var(--font-heading)", fontWeight: 600, fontSize: 64, lineHeight: 1 }}>{c.big}</div>
                <div className="muted" style={{ fontSize: 12, letterSpacing: ".08em", textTransform: "uppercase" }}>{c.bigLabel}</div>
              </div>
              <div>
                {c.lines.map((l) => (
                  <div key={l.a} style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: 14, padding: "6px 0", borderTop: "1px solid #e3eaf2" }}>
                    <span className="muted">{l.a}</span><strong style={{ fontWeight: 600 }}>{l.b}</strong>
                  </div>
                ))}
              </div>
              <div className="muted" style={{ fontSize: 12 }}>{c.foot}</div>
            </div>
          );
        })}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,220px),1fr))", border: "1px solid var(--color-divider)" }}>
        <div style={{ padding: "12px 16px", fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: 19, color: "#0d4884", display: "flex", alignItems: "center" }}>
          Mes a la fecha · {monthStartLabel(data.day)}–{data.day.slice(8)}
        </div>
        {data.month.map((m) => (
          <div key={m.a} style={{ padding: "12px 16px", borderLeft: "1px solid var(--color-divider)" }}>
            <div className="muted" style={{ fontSize: 11, letterSpacing: ".08em", textTransform: "uppercase" }}>{m.a}</div>
            <div style={{ fontFamily: "var(--font-heading)", fontWeight: 600, fontSize: 26 }}>{m.b}</div>
          </div>
        ))}
      </div>

      <div className="muted" style={{ display: "flex", flexWrap: "wrap", gap: 16, fontSize: 12, alignItems: "center" }}>
        <span>Semáforo</span>
        {[[G, "verde ≥ 98%"], [A, "amarillo 95–98%"], [R, "rojo < 95%"]].map(([s, t]) => (
          <span key={t as string} style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
            <span className="dot" style={{ width: 10, height: 10, background: (s as typeof G).c }} />{t as string}
          </span>
        ))}
      </div>
    </>
  );
}
