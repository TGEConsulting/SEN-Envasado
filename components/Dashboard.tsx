"use client";

import { useEffect, useMemo, useState } from "react";
import { monthLabel, sem } from "@/lib/domain";
import type { Dashboard as D } from "@/lib/dashboard";

const COLORS = ["#0d4884", "#149bd8", "#78be20", "#f2a900", "#db0030"];
type Ind = D["indicators"][number];
const mean = (a: (number | null)[]) => { const v = a.filter((x): x is number => x != null); return v.length ? v.reduce((s, x) => s + x, 0) / v.length : null; };
const fmt = (ind: Ind, v: number | null) => v == null ? "—" : ind.key === "par" ? `${Math.round(v)} min` : ind.key === "sob" ? (v >= 0 ? "+" : "") + (v * 100).toFixed(1) + "%" : (v * 100).toFixed(1) + "%";
const short = (ind: Ind, v: number | null) => v == null ? "–" : ind.key === "par" ? String(Math.round(v)) : ind.kind === "r" ? String(Math.round(v * 100)) : (v * 100).toFixed(1);

export default function Dashboard({ day }: { day: string }) {
  const [d, setD] = useState<D | null>(null);
  const [err, setErr] = useState("");
  const [ki, setKi] = useState(0);
  const [maq, setMaq] = useState<string>("all");

  useEffect(() => {
    let off = false;
    setD(null);
    (async () => {
      const r = await fetch(`/api/dashboard?day=${day}`);
      if (off) return;
      if (!r.ok) return setErr("No se pudo cargar el dashboard.");
      setErr(""); setD(await r.json());
    })();
    return () => { off = true; };
  }, [day]);

  const scope = useMemo(() => (d ? d.machines.map((_, i) => i).filter((i) => maq === "all" || d.machines[i] === maq) : []), [d, maq]);
  if (err) return <div role="alert" style={{ padding: 12, borderRadius: 10, background: "#fde3e8", color: "#9a0022" }}>{err}</div>;
  if (!d) return <div className="muted">Cargando…</div>;

  const ind = d.indicators[ki];
  const dailyMean = (k: number) => d.days.map((_, di) => mean(scope.map((mi) => d.values[k][mi][di])));
  const avgOf = (k: number, mi: number) => mean(d.values[k][mi]);

  const kpis = d.indicators.map((x, k) => {
    const dm = dailyMean(k), avg = mean(dm), have = dm.filter((v): v is number => v != null);
    let delta = "Sin comparación", dcol = "var(--color-neutral-700)";
    if (have.length >= 4) {
      const last = mean(have.slice(-3))!, prev = mean(have.slice(-6, -3))!, diff = last - prev;
      const good = x.kind === "r" ? diff > 0 : diff < 0;
      delta = `${diff > 0 ? "▲" : diff < 0 ? "▼" : "•"} ${diff >= 0 ? "+" : ""}${x.key === "par" ? Math.round(diff) + " min" : (diff * 100).toFixed(1) + " pts"} vs 3 días previos`;
      dcol = Math.abs(diff) < 1e-9 ? dcol : good ? "#2f5f0b" : "#9a0022";
    }
    return { x, k, dm, avg, delta, dcol };
  });

  // gráfica de líneas por máquina
  const W = 800, H = 250, PL = 44, PR = 12, PT = 12, PB = 26;
  const vis = scope.map((mi) => ({ mi, vals: d.values[ki][mi] }));
  const all = vis.flatMap((v) => v.vals).filter((x): x is number => x != null);
  const lo = ind.kind === "r" ? Math.min(0.8, ...(all.length ? [Math.min(...all) - 0.03] : [])) : 0;
  const hi = ind.kind === "r" ? Math.max(1.1, ...(all.length ? [Math.max(...all) + 0.03] : [])) : Math.max(...all, ind.key === "par" ? 10 : 0.02) * 1.15;
  const X = (i: number) => PL + (d.days.length <= 1 ? 0 : (i / (d.days.length - 1)) * (W - PL - PR));
  const Y = (v: number) => PT + (1 - (v - lo) / (hi - lo || 1)) * (H - PT - PB);
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => lo + t * (hi - lo));
  const heatMax = Math.max(...d.values[ki].flat().filter((x): x is number => x != null), 1e-9);

  return (
    <>
      <div>
        <div style={{ fontSize: 12, marginBottom: 6, fontWeight: 600, color: "#0b6a9a", textTransform: "capitalize" }}>{monthLabel(day)} · 1 al {Number(day.slice(8))}</div>
        <h1 style={{ margin: 0, fontSize: 44, lineHeight: 1.05, color: "#0d4884" }}>Dashboard mensual</h1>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, padding: "12px 14px", background: "#f6faff", border: "2px solid #cfe2f5", borderRadius: 14 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: "#0d4884", marginRight: 4 }}>Máquina</span>
        {(["all", ...d.machines] as string[]).map((m, i) => (
          <button key={m} onClick={() => setMaq(m)} aria-pressed={maq === m}
            style={{ cursor: "pointer", font: "inherit", fontSize: 14, fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 8, padding: "7px 14px", borderRadius: 999, border: "2px solid #0d4884", background: maq === m ? "#0d4884" : "#fff", color: maq === m ? "#fff" : "#0d4884" }}>
            <span style={{ width: 10, height: 10, borderRadius: "50%", background: i === 0 ? "#8a97a8" : COLORS[i - 1], border: "2px solid #fff" }} />{m === "all" ? "Todas" : m}
          </button>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,170px),1fr))", gap: 14 }}>
        {kpis.map(({ x, k, dm, avg, delta, dcol }) => {
          const on = k === ki, st = x.kind === "r" && avg != null ? sem(avg).c : "var(--color-accent)";
          const vals = dm.filter((v): v is number => v != null), mn = Math.min(...vals), mx = Math.max(...vals);
          const pts = dm.map((v, i) => (v == null ? null : `${(i / Math.max(dm.length - 1, 1)) * 100},${20 - (mx === mn ? 10 : ((v - mn) / (mx - mn)) * 18)}`)).filter(Boolean).join(" ");
          return (
            <button key={x.key} onClick={() => setKi(k)} aria-pressed={on}
              style={{ cursor: "pointer", font: "inherit", textAlign: "left", display: "flex", flexDirection: "column", gap: 4, padding: 14, borderRadius: 14, border: `2px solid ${on ? "#0d4884" : "#9fc6e8"}`, background: on ? "#e6f0fa" : "#fff" }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: "#0d4884", display: "flex", alignItems: "center", gap: 6 }}><span style={{ width: 9, height: 9, borderRadius: "50%", background: st }} />{x.label}</span>
              <span style={{ fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: 34, lineHeight: 1.05 }}>{fmt(x, avg)}</span>
              <svg viewBox="0 0 100 22" preserveAspectRatio="none" style={{ width: "100%", height: 22 }} aria-hidden="true"><polyline points={pts} fill="none" stroke="#0d4884" strokeWidth="1.5" vectorEffect="non-scaling-stroke" /></svg>
              <span style={{ fontSize: 12, fontWeight: 600, color: dcol }}>{delta}</span>
            </button>
          );
        })}
      </div>

      <div className="blueprint" style={{ padding: 18 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8, flexWrap: "wrap", marginBottom: 6 }}>
          <span style={{ fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: 21, color: "#0d4884" }}>{ind.label} · tendencia diaria</span>
          <span className="muted" style={{ fontSize: 12 }}>{maq === "all" ? "Todas las máquinas" : maq} · {ind.kind === "r" ? "Línea punteada = 100%" : "Sin meta definida; menor es mejor"}</span>
        </div>
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto" }} role="img" aria-label={`Tendencia diaria de ${ind.label}`}>
          {ticks.map((t) => <g key={t}><line x1={PL} x2={W - PR} y1={Y(t)} y2={Y(t)} stroke="#e3eaf2" /><text x={PL - 6} y={Y(t) + 4} fontSize="11" textAnchor="end" fill="#4f5b6d">{short(ind, t)}</text></g>)}
          {ind.kind === "r" && <line x1={PL} x2={W - PR} y1={Y(1)} y2={Y(1)} stroke="#0d4884" strokeDasharray="5 4" />}
          {d.days.map((dd, i) => (i % Math.ceil(d.days.length / 16) === 0) && <text key={dd} x={X(i)} y={H - 6} fontSize="11" textAnchor="middle" fill="#4f5b6d">{Number(dd.slice(8))}</text>)}
          {vis.map(({ mi, vals }) => {
            const segs: string[] = []; let cur: string[] = [];
            vals.forEach((v, i) => { if (v == null) { if (cur.length) segs.push(cur.join(" ")); cur = []; } else cur.push(`${X(i)},${Y(v)}`); });
            if (cur.length) segs.push(cur.join(" "));
            return <g key={mi}>{segs.map((p, j) => <polyline key={j} points={p} fill="none" stroke={COLORS[mi]} strokeWidth="2.5" />)}
              {vals.map((v, i) => v != null && <circle key={i} cx={X(i)} cy={Y(v)} r="3.5" fill={COLORS[mi]} />)}</g>;
          })}
        </svg>
        {all.length === 0 && <div className="muted" style={{ fontSize: 13, padding: "6px 0" }}>Sin datos de este indicador en el mes.</div>}
        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px 18px", marginTop: 8 }}>
          {scope.map((mi) => (
            <button key={mi} onClick={() => setMaq(maq === d.machines[mi] ? "all" : d.machines[mi])} style={{ cursor: "pointer", font: "inherit", fontSize: 13, background: "none", border: 0, padding: 0, display: "inline-flex", alignItems: "center", gap: 7 }}>
              <span style={{ width: 14, height: 4, borderRadius: 2, background: COLORS[mi] }} /><strong style={{ fontWeight: 600 }}>{d.machines[mi]}</strong><span className="muted">prom. {fmt(ind, avgOf(ki, mi))}</span>
            </button>))}
        </div>
      </div>

      <div className="blueprint" style={{ padding: 18 }}>
        <div style={{ fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: 19, color: "#0d4884", marginBottom: 10 }}>Promedio del mes por máquina · {ind.label}</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {d.machines.map((m, mi) => { const v = avgOf(ki, mi), w = v == null ? 0 : ind.kind === "r" ? Math.min(v / 1.2, 1) : Math.min(Math.abs(v) / (heatMax || 1), 1);
            return (
              <div key={m} style={{ display: "grid", gridTemplateColumns: "92px 1fr 70px", alignItems: "center", gap: 10, opacity: maq === "all" || maq === m ? 1 : 0.35 }}>
                <button onClick={() => setMaq(maq === m ? "all" : m)} style={{ cursor: "pointer", font: "inherit", fontWeight: 600, fontSize: 14, color: "#0d4884", background: "none", border: 0, padding: 0, textAlign: "left" }}>{m}</button>
                <div style={{ height: 18, background: "#eaf1f8", borderRadius: 6 }}><div style={{ height: "100%", width: `${w * 100}%`, background: COLORS[mi], borderRadius: 6 }} /></div>
                <span style={{ fontWeight: 700, fontSize: 15, textAlign: "right" }}>{fmt(ind, v)}</span>
              </div>); })}
        </div>
      </div>

      <div className="blueprint" style={{ padding: 18, overflowX: "auto" }}>
        <div style={{ fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: 19, color: "#0d4884", marginBottom: 10 }}>Mapa de calor por día · {ind.label}</div>
        <div style={{ minWidth: 640, display: "flex", flexDirection: "column", gap: 4 }}>
          <div className="muted" style={{ display: "grid", gridTemplateColumns: `84px repeat(${d.days.length},1fr)`, gap: 3, fontSize: 11, fontWeight: 600, textAlign: "center" }}>
            <span />{d.days.map((dd) => <span key={dd}>{Number(dd.slice(8))}</span>)}
          </div>
          {d.machines.map((m, mi) => (
            <div key={m} style={{ display: "grid", gridTemplateColumns: `84px repeat(${d.days.length},1fr)`, gap: 3, alignItems: "center" }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: "#0d4884" }}>{m}</span>
              {d.values[ki][mi].map((v, i) => {
                const s = v == null ? null : ind.kind === "r" ? sem(v) : null;
                const bg = v == null ? "transparent" : s ? s.t : `rgba(13,72,132,${(0.08 + 0.5 * Math.min(Math.abs(v) / heatMax, 1)).toFixed(2)})`;
                return <span key={i} style={{ textAlign: "center", padding: "7px 0", fontSize: 11, fontWeight: 600, borderRadius: 5, background: bg, color: s ? s.i : "var(--color-text)" }}>{short(ind, v)}</span>;
              })}
            </div>
          ))}
        </div>
      </div>
      <div style={{ padding: "12px 14px", fontSize: 13, background: "#e6f0fa", color: "#0a3d5c", borderRadius: 10 }}>{d.note}</div>
    </>
  );
}
