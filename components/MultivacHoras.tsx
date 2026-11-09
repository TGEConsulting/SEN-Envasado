"use client";

import { computeHourly, HOURLY_PRODUCTS, type HRow } from "@/lib/multivac";

const cell = (w: number): React.CSSProperties => ({ width: w, padding: "4px 6px", minHeight: 30, textAlign: "right" });
const right: React.CSSProperties = { textAlign: "right" };

export default function MultivacHoras({ product, onProduct, rows, onChange, locked }: {
  product: number; onProduct: (id: number) => void; rows: HRow[]; locked: boolean;
  onChange: (i: number, k: keyof HRow, v: string) => void;
}) {
  const r = computeHourly(rows);
  const name = HOURLY_PRODUCTS.find(([id]) => id === product)?.[1] ?? "";
  const inp = (i: number, k: keyof HRow, w: number) => (
    <input className="input" inputMode="numeric" style={cell(w)} value={rows[i][k]} disabled={locked}
      onChange={(e) => onChange(i, k, e.target.value)} aria-label={`${k} ${r.calc[i].ini}`} />
  );
  return (
    <>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "#0d4884" }}>Producto de Multivac · un registro por producto</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 8 }}>
          {HOURLY_PRODUCTS.map(([id, label]) => {
            const on = id === product;
            return (
              <button key={id} onClick={() => onProduct(id)} aria-pressed={on}
                style={{ cursor: "pointer", font: "inherit", textAlign: "left", padding: "10px 14px", border: "2px solid #0d4884", borderRadius: 12,
                  background: on ? "#0d4884" : "#fff", color: on ? "#fff" : "#0d4884" }}>
                <div style={{ fontWeight: 700, fontSize: 16 }}>{label}</div>
                <div style={{ fontSize: 12, opacity: 0.85 }}>Artículo {id}</div>
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,160px),1fr))", gap: 16 }}>
        {r.kpis.map((k) => (
          <div key={k.label} className="blueprint" style={{ padding: 14, display: "flex", flexDirection: "column", gap: 2, overflow: "hidden" }}>
            <div className="muted" style={{ fontSize: 11, letterSpacing: ".08em", textTransform: "uppercase" }}>{k.label}</div>
            <div style={{ fontFamily: "var(--font-heading)", fontWeight: 600, fontSize: 36, lineHeight: 1.05 }}>{k.val}</div>
            <div className="muted" style={{ fontSize: 12 }}>{k.sub}</div>
            <div style={{ height: 3, background: k.bar, margin: "6px -14px -14px" }} />
          </div>
        ))}
      </div>

      <div className="blueprint" style={{ padding: 16, overflowX: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
          <div className="card-title" style={{ fontSize: 19 }}>Empaque diario · {name}</div>
          <span className="muted" style={{ fontSize: 12 }}>Meta de 900 pzs por hora (se configurará en Configuración › Multivac). El resto se calcula.</span>
        </div>
        <table className="table" style={{ minWidth: 1100 }}>
          <thead><tr>
            <th>Hora inicio</th><th>Hora final</th><th style={right}>Meta de piezas por empacar</th><th style={right}>Piezas empacadas</th>
            <th style={right}>Diferencias</th><th style={right}>Rendimiento</th><th style={right}>Almacenamiento</th>
            <th style={right}>Paro por mto. (min)</th><th style={right}>Cambios de bobina</th>
            <th style={right}>Tiempo de cambio de bobina (min)</th><th style={right}>Tiempo total trabajado</th>
          </tr></thead>
          <tbody>
            {r.calc.map((c, i) => (
              <tr key={c.ini}>
                <td>{c.ini}</td>
                <td><input className="input" type="time" style={{ width: 112, padding: "4px 6px", minHeight: 30 }} value={rows[i].fin} disabled={locked}
                  onChange={(e) => onChange(i, "fin", e.target.value)} aria-label={`hora final ${c.ini}`} /></td>
                <td style={right}>{c.meta}</td>
                <td style={right}>{inp(i, "pzs", 84)}</td>
                <td style={right}>{c.diff}</td>
                <td style={right}><span style={{ padding: "2px 6px", background: c.est ? c.est.t : "transparent", color: c.est ? c.est.i : "var(--color-neutral-700)" }}>{c.rend}</span></td>
                <td style={right}>{inp(i, "alm", 84)}</td>
                <td style={right}>{inp(i, "paro", 64)}</td>
                <td style={right}>{inp(i, "bob", 64)}</td>
                <td style={right}>{inp(i, "tcb", 72)}</td>
                <td style={right}>{c.trab}</td>
              </tr>
            ))}
            <tr style={{ fontWeight: 600 }}>
              <td colSpan={2} style={{ letterSpacing: ".08em", textTransform: "uppercase", fontSize: 12 }}>Acumulado</td>
              <td style={right}>{r.acc.meta}</td><td style={right}>{r.acc.pzs}</td><td style={right}>{r.acc.diff}</td><td style={right}>{r.acc.rend}</td>
              <td style={right}>{r.acc.alm}</td><td style={right}>{r.acc.paro}</td><td style={right}>{r.acc.bob}</td>
              <td style={right}>{r.acc.tcb}</td><td style={right}>{r.acc.trab}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {r.warns.map((w, i) => (
          <div key={i} style={{ padding: "10px 12px", fontSize: 13, background: w.s.t, color: w.s.i, border: `1px solid ${w.s.c}` }}>
            <strong style={{ fontWeight: 600 }}>{w.h}</strong> {w.m}
          </div>
        ))}
      </div>
    </>
  );
}
