"use client";

import { useEffect, useState } from "react";
import { PROCESSES, dayLong } from "@/lib/domain";
import type { Detalle as D } from "@/lib/detalle";

const h2: React.CSSProperties = { fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: 19, color: "#0d4884" };
const right: React.CSSProperties = { textAlign: "right" };
const chipSt = (s: { t: string; i: string }): React.CSSProperties => ({ fontSize: 12, padding: "2px 8px", background: s.t, color: s.i, whiteSpace: "nowrap" });

export default function Detalle({ tab, day }: { tab: string; day: string }) {
  const [d, setD] = useState<D | null>(null);
  const [product, setProduct] = useState<number | undefined>();
  const [pf, setPf] = useState("all");
  const [err, setErr] = useState("");

  useEffect(() => {
    let off = false;
    setD(null);
    (async () => {
      const r = await fetch(`/api/detalle?tab=${tab}&day=${day}` + (product ? `&product=${product}` : ""));
      if (off) return;
      if (!r.ok) return setErr("No se pudo cargar el detalle.");
      setErr(""); setD(await r.json());
    })();
    return () => { off = true; };
  }, [tab, day, product]);
  useEffect(() => { setProduct(undefined); }, [tab]);

  if (err) return <div role="alert" style={{ padding: 12, borderRadius: 10, background: "#fde3e8", color: "#9a0022" }}>{err}</div>;
  if (!d) return <div className="muted">Cargando…</div>;

  return (
    <>
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "flex-end", gap: 8 }}>
        <div><div className="kicker">Jornada {dayLong(d.day)}</div><h1 style={{ margin: 0, fontSize: 44, lineHeight: 1.05 }}>{d.title}</h1></div>
        <div className="muted" style={{ fontSize: 13 }}>{d.sub}</div>
      </div>

      {d.noData && <div className="blueprint" style={{ padding: 28 }} role="status">Sin registro para este indicador el {dayLong(d.day)}.</div>}

      {d.kind === "multivac" && d.multivac && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#0d4884" }}>Producto</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 8 }}>
            {d.multivac.products.map((p) => { const on = p.id === d.multivac!.product; return (
              <button key={p.id} onClick={() => setProduct(p.id)} aria-pressed={on}
                style={{ cursor: "pointer", font: "inherit", textAlign: "left", padding: "10px 14px", border: "2px solid #0d4884", borderRadius: 12, background: on ? "#0d4884" : "#fff", color: on ? "#fff" : "#0d4884" }}>
                <div style={{ fontWeight: 700, fontSize: 16 }}>{p.label}</div><div style={{ fontSize: 12, opacity: 0.85 }}>{p.sub}</div></button>); })}
          </div>
        </div>
      )}

      {!d.noData && d.kpis.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,160px),1fr))", gap: 16 }}>
          {d.kpis.map((k) => (
            <div key={k.label} className="blueprint" style={{ padding: 14, display: "flex", flexDirection: "column", gap: 4, overflow: "hidden" }}>
              <div className="muted" style={{ fontSize: 11, letterSpacing: ".08em", textTransform: "uppercase" }}>{k.label}</div>
              <div style={{ fontFamily: "var(--font-heading)", fontWeight: 600, fontSize: 42, lineHeight: 1.05 }}>{k.val}</div>
              <div className="muted" style={{ fontSize: 12, minHeight: 15 }}>{k.sub}</div>
              <div style={{ height: 3, background: k.bar, margin: "6px -14px -14px" }} />
            </div>
          ))}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,320px),1fr))", gap: 20, alignItems: "start" }}>
        <div className="blueprint" style={{ padding: 16 }}>
          <div style={{ ...h2, marginBottom: 12 }}>{d.sparkTitle}</div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 10, height: 170 }}>
            {d.spark.map((b) => (
              <div key={b.lab} style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "flex-end", alignItems: "center", gap: 4, height: "100%" }}>
                <span style={{ fontSize: 12, fontWeight: b.cur ? 700 : 400 }}>{b.txt}</span>
                <div style={{ width: "100%", height: b.h, background: b.c, opacity: b.cur ? 1 : 0.55 }} />
                <span className="muted" style={{ fontSize: 12, fontWeight: b.cur ? 700 : 400 }}>{b.lab}</span>
              </div>
            ))}
          </div>
        </div>

        {d.kind === "batch" && d.batch && (
          <div className="blueprint" style={{ padding: 16 }}>
            <div style={{ ...h2, marginBottom: 4 }}>Retraso por batch (min)</div>
            <div className="muted" style={{ fontSize: 12, marginBottom: 10 }}>Verde dentro de la tolerancia · amarillo hasta 20 · rojo más de 20</div>
            {d.batch.delays.length === 0 ? <div className="muted" style={{ fontSize: 13, padding: 12, background: "var(--color-neutral-200)" }}>Sin captura de batches. Captura en Empaque › {d.title}.</div> : (
              <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 170 }}>
                {d.batch.delays.map((b) => (
                  <div key={b.n} style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", justifyContent: "flex-end", alignItems: "center", gap: 3, height: "100%" }}>
                    <span style={{ fontSize: 11 }}>{b.txt}</span><div style={{ width: "100%", height: b.h, background: b.c }} />
                    <span className="muted" style={{ fontSize: 11 }}>{b.n}</span>
                  </div>
                ))}
              </div>)}
          </div>
        )}
      </div>

      {d.kind === "multivac" && d.multivac && (<>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,240px),1fr))", gap: 16 }}>
          {d.multivac.sku.map((s) => (
            <div key={s.name} className="blueprint" style={{ padding: 14, display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><strong style={{ fontWeight: 600 }}>{s.name}</strong><span style={chipSt(s.st)}>{s.st.l}</span></div>
              <div style={{ height: 10, background: "rgba(22,26,45,.08)", position: "relative" }}>
                <div style={{ height: "100%", width: `${s.w * 100}%`, background: s.st.c }} />
                <div style={{ position: "absolute", left: `${s.mark * 100}%`, top: -3, bottom: -3, width: 1, background: "var(--color-text)" }} />
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}><span className="muted">{s.nums}</span><strong style={{ fontWeight: 600 }}>{s.pct}</strong></div>
            </div>
          ))}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,320px),1fr))", gap: 20, alignItems: "start" }}>
          <div className="blueprint" style={{ padding: 16 }}>
            <div style={{ ...h2, marginBottom: 10 }}>Rendimiento por hora · {d.multivac.products.find((p) => p.id === d.multivac!.product)?.label}</div>
            {d.multivac.bars.length === 0 ? <div className="muted" style={{ fontSize: 13, padding: 12, background: "var(--color-neutral-200)" }}>Sin captura por hora. Captura en Empaque › Multivac.</div> : (
              <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 170 }}>
                {d.multivac.bars.map((b) => (
                  <div key={b.n} style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", justifyContent: "flex-end", alignItems: "center", gap: 3, height: "100%" }}>
                    <span style={{ fontSize: 11 }}>{b.txt}</span><div style={{ width: "100%", height: b.h, background: b.c }} /><span className="muted" style={{ fontSize: 11 }}>{b.n}h</span>
                  </div>))}
              </div>)}
          </div>
          <div className="blueprint" style={{ padding: 16, overflowX: "auto" }}>
            <table className="table" style={{ minWidth: 420, fontSize: 13 }}>
              <thead><tr><th>Horario</th><th style={right}>Meta</th><th style={right}>Empacadas</th><th style={right}>Dif.</th><th style={right}>Rendim.</th><th style={right}>Paro</th></tr></thead>
              <tbody>{d.multivac.rows.map((r) => (
                <tr key={r.lab}><td style={{ whiteSpace: "nowrap" }}>{r.lab}</td><td style={right}>{r.meta}</td><td style={right}>{r.pzs}</td><td style={right}>{r.diff}</td>
                  <td style={right}><span style={{ padding: "2px 6px", background: r.est?.t ?? "transparent", color: r.est?.i ?? "var(--color-neutral-700)" }}>{r.rend}</span></td><td style={right}>{r.paro}</td></tr>))}</tbody>
            </table>
          </div>
        </div>
      </>)}

      {d.kind === "batch" && d.batch && (<>
        <div className="blueprint" style={{ padding: 16, overflowX: "auto" }}>
          <div style={{ ...h2, marginBottom: 8 }}>Batches de la jornada</div>
          <table className="table" style={{ minWidth: 520 }}>
            <thead><tr><th>Batch</th><th>Hora esperada</th><th>Hora real</th><th style={right}>Retraso</th><th style={right}>Piezas</th><th style={right}>Rendimiento</th><th>Estado</th></tr></thead>
            <tbody>{d.batch.rows.map((r) => (
              <tr key={r.n}><td>{r.n}</td><td>{r.exp}</td><td>{r.real}</td><td style={right}>{r.d}</td><td style={right}>{r.pz}</td><td style={right}>{r.rend}</td><td><span style={chipSt(r.st)}>{r.st.l}</span></td></tr>))}</tbody>
          </table>
        </div>
        <div className="blueprint" style={{ padding: 16, overflowX: "auto" }}>
          <div style={{ ...h2, marginBottom: 8 }}>Programa de empaque · {d.title}</div>
          <table className="table" style={{ minWidth: 420 }}>
            <thead><tr><th>Artículo</th><th>Descripción</th><th style={right}>Programado</th></tr></thead>
            <tbody>
              {d.batch.prog.map((p) => <tr key={p.id}><td>{p.id}</td><td>{p.name}</td><td style={right}>{p.p}</td></tr>)}
              {d.batch.prog.length > 0 && <tr style={{ fontWeight: 600 }}><td colSpan={2} style={{ ...right, letterSpacing: ".08em", textTransform: "uppercase", fontSize: 12 }}>Total</td><td style={right}>{d.batch.progTotal}</td></tr>}
            </tbody>
          </table>
          {d.batch.prog.length === 0 && <div className="muted" style={{ fontSize: 13, padding: 12, background: "var(--color-neutral-200)" }}>Sin artículos asignados a este proceso. Asigna productos en Datos › Proceso (Planeador).</div>}
          <div className="muted" style={{ fontSize: 12, marginTop: 10 }}>El empacado se captura por batch en Empaque, con la máquina «{d.title}».</div>
        </div>
      </>)}

      {d.kind === "ent" && d.ent && (
        <div className="blueprint" style={{ padding: 16, overflowX: "auto" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
            <div style={h2}>Entregas por artículo · todos los procesos</div>
            <select className="input" style={{ width: "auto" }} value={pf} onChange={(e) => setPf(e.target.value)} aria-label="Filtrar por proceso">
              <option value="all">Todos los procesos</option>{PROCESSES.map((p) => <option key={p}>{p}</option>)}</select>
          </div>
          <table className="table" style={{ minWidth: 560 }}>
            <thead><tr><th>SKU</th><th>Producto</th><th>Proceso</th><th style={right}>Programado</th><th style={right}>Entregado</th><th style={right}>Faltante</th><th style={right}>%</th><th>Estado</th></tr></thead>
            <tbody>{d.ent.rows.filter((r) => pf === "all" || r.proc === pf).map((r) => (
              <tr key={r.sku}><td>{r.sku}</td><td>{r.name}</td><td>{r.proc}</td><td style={right}>{r.p}</td><td style={right}>{r.e}</td><td style={right}>{r.f}</td>
                <td style={{ ...right, fontWeight: 600 }}>{r.pct}</td><td><span style={chipSt(r.st)}>{r.st.l}</span></td></tr>))}</tbody>
          </table>
          <div className="muted" style={{ fontSize: 12, marginTop: 10 }}>El programa se carga en Datos; lo entregado se captura en Datos › Entregado.</div>
        </div>
      )}
    </>
  );
}
