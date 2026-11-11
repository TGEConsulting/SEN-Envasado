"use client";

import { useEffect, useMemo, useState } from "react";
import { MULTIVAC_IDS, MULTIVAC_NAMES } from "@/lib/config";
import { REPORT_LIST, REPORT_MACHINES, type ReportData } from "@/lib/reportes-meta";

const lab: React.CSSProperties = { fontSize: 12, color: "var(--color-neutral-700)" };
const fmt = (v: string | number) => (typeof v === "number" ? v.toLocaleString("en-US", { maximumFractionDigits: 3 }) : String(v ?? ""));
const numeric = (v: string | number) => typeof v === "number" || /^[-+]?[\d,.]+(%| min)?$/.test(String(v));

export default function Reportes({ day }: { day: string }) {
  const [rep, setRep] = useState<string>("tablero");
  const [machine, setMachine] = useState<string>("Tecnovac");
  const [product, setProduct] = useState<number>(MULTIVAC_IDS[0]);
  const [data, setData] = useState<ReportData | null>(null);
  const [err, setErr] = useState("");
  const [issued, setIssued] = useState("");

  const qs = useMemo(() => new URLSearchParams({ rep, day, machine, product: String(product) }).toString(), [rep, day, machine, product]);

  useEffect(() => {
    let off = false;
    (async () => {
      const r = await fetch(`/api/reportes?${qs}`);
      if (off) return;
      if (!r.ok) return setErr("No se pudo generar el reporte.");
      setErr(""); setData(await r.json());
      setIssued(new Date().toLocaleString("es-MX", { timeZone: "America/Mexico_City", dateStyle: "medium", timeStyle: "short" }));
    })();
    return () => { off = true; };
  }, [qs]);

  const alignOf = (head: string[], rows: (string | number)[][]) => head.map((_, i) => (rows.length > 0 && rows.every((r) => r[i] === "" || numeric(r[i])) ? "right" : "left") as "left" | "right");
  const align = useMemo(() => (data ? alignOf(data.head, data.rows) : []), [data]);

  return (
    <>
      <div><div className="kicker">Reportes</div><h1 style={{ margin: 0, fontSize: 44, lineHeight: 1.05 }}>Impresión y exportación</h1></div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 20, alignItems: "flex-start" }}>
        <div className="blueprint no-print" style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12, flex: "0 0 280px", maxWidth: "100%" }}>
          <div className="card-title" style={{ fontSize: 19 }}>Reporte</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {REPORT_LIST.map((t) => (
              <button key={t.id} onClick={() => setRep(t.id)} aria-pressed={t.id === rep}
                style={{ cursor: "pointer", textAlign: "left", font: "inherit", fontSize: 14, padding: "8px 12px", border: `1px solid ${t.id === rep ? "#0d4884" : "var(--color-divider)"}`, background: t.id === rep ? "#0d4884" : "transparent", color: t.id === rep ? "#fff" : "var(--color-text)" }}>{t.label}</button>
            ))}
          </div>
          {rep === "batches" && (
            <>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}><label htmlFor="r-maq" style={lab}>Máquina</label>
                <select id="r-maq" className="input" value={machine} onChange={(e) => setMachine(e.target.value)}>{REPORT_MACHINES.map((m) => <option key={m}>{m}</option>)}</select></div>
              {machine === "Multivac" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}><label htmlFor="r-prod" style={lab}>Producto</label>
                  <select id="r-prod" className="input" value={product} onChange={(e) => setProduct(Number(e.target.value))}>{MULTIVAC_IDS.map((id) => <option key={id} value={id}>{MULTIVAC_NAMES[id]}</option>)}</select></div>
              )}
            </>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <button className="btn btn-primary" onClick={() => setTimeout(() => window.print(), 50)} disabled={!data}>Imprimir</button>
            <a className="btn btn-secondary" href={`/api/reportes/xlsx?${qs}`}>Exportar a Excel</a>
            <a className="btn btn-secondary" href={`/api/reportes/xlsx?${qs}&all=1`}>Libro completo (todas las hojas)</a>
          </div>
          <div className="muted" style={{ fontSize: 12 }}>El resumen usa el día elegido arriba. La bitácora muestra los últimos 1,000 movimientos sin importar el día.</div>
        </div>

        <div id="sen-report" className="blueprint" style={{ padding: 24, overflowX: "auto", flex: "1 1 460px", minWidth: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: "6px 12px", flexWrap: "wrap", borderBottom: "2px solid var(--color-text)", paddingBottom: 12, marginBottom: 14 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
              <img src="/logo-1tinta.png" alt="La Quinta" style={{ height: 48, width: "auto", alignSelf: "center" }} />
              <span style={{ fontFamily: "var(--font-heading)", fontWeight: 800, fontSize: 26, color: "#0d4884" }}>SEN</span>
              <span className="muted" style={{ fontSize: 13 }}>Sistema de Envasado</span>
            </div>
            <span className="muted" style={{ fontSize: 12 }}>Emitido {issued}</span>
          </div>
          {err ? <div role="alert" style={{ color: "#9a0022" }}>{err}</div> : !data ? <div className="muted">Generando…</div> : (<>
            <h2 style={{ margin: 0, fontSize: 28, lineHeight: 1.1 }}>{data.name}</h2>
            <div className="muted" style={{ fontSize: 13, margin: "2px 0 12px" }}>{data.sub}</div>
            <table className="table" style={{ minWidth: 420, fontSize: 13 }}>
              <thead><tr>{data.head.map((h, i) => <th key={h + i} style={{ textAlign: align[i] as "left" | "right" }}>{h}</th>)}</tr></thead>
              <tbody>{data.rows.map((r, i) => <tr key={i}>{r.map((v, j) => <td key={j} style={{ textAlign: align[j] as "left" | "right" }}>{fmt(v)}</td>)}</tr>)}</tbody>
            </table>
            {data.rows.length === 0 && <div className="muted" style={{ padding: "16px 0", fontSize: 14 }}>Sin datos para este reporte.</div>}
            {(data.sections ?? []).map((sec) => { const al = alignOf(sec.head, sec.rows); return (
              <div key={sec.title} style={{ marginTop: 22, overflowX: "auto" }}>
                <div className="card-title" style={{ fontSize: 17, marginBottom: 6 }}>{sec.title}</div>
                <table className="table" style={{ minWidth: 520, fontSize: 12 }}>
                  <thead><tr>{sec.head.map((h, i) => <th key={h + i} style={{ textAlign: al[i] }}>{h}</th>)}</tr></thead>
                  <tbody>{sec.rows.map((r, i) => <tr key={i} style={r[1] === "TOTAL" || String(r[1]).startsWith("TOTAL") ? { fontWeight: 600 } : undefined}>{r.map((v, j) => <td key={j} style={{ textAlign: al[j] }}>{fmt(v)}</td>)}</tr>)}</tbody>
                </table>
              </div>); })}
            <div className="muted" style={{ fontSize: 12, marginTop: 10 }}>{data.rows.length} fila(s)</div>
          </>)}
        </div>
      </div>
    </>
  );
}
