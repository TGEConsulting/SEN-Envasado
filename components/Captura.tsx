"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { A, G, R, N, type Sem } from "@/lib/domain";
import { CAPTURE_MACHINES, DEFAULT_TIMES, TARGET_WEIGHT_G, compute, emptyRows, hasDowntime, type Row } from "@/lib/capture";

const today = () => new Date().toISOString().slice(0, 10);
const lab: React.CSSProperties = { fontSize: 12, color: "var(--color-neutral-700)" };
const cell = (w: number): React.CSSProperties => ({ width: w, padding: "4px 6px", minHeight: 30, textAlign: "right" });
const pill = (s: Sem | null): React.CSSProperties => ({ padding: "2px 6px", background: s ? s.t : "transparent", color: s ? s.i : "var(--color-neutral-700)" });

export default function Captura({ role }: { role: string }) {
  const [day, setDay] = useState(today());
  const [machine, setMachine] = useState<string>("Tecnovac");
  const [team, setTeam] = useState(1);
  const [leader, setLeader] = useState("");
  const [supervisor, setSupervisor] = useState("");
  const [rows, setRows] = useState<Row[]>(emptyRows());
  const [signed, setSigned] = useState(false);
  const [msg, setMsg] = useState<{ t: string; bad?: boolean } | null>(null);
  const [busy, setBusy] = useState(false);

  const isMulti = machine === "Multivac";
  const locked = signed && role !== "Administrador";
  const r = useMemo(() => compute(machine, rows), [machine, rows]);
  const showPar = hasDowntime(machine);

  const load = useCallback(async () => {
    if (isMulti) return;
    setMsg(null);
    const res = await fetch(`/api/capture?day=${day}&machine=${encodeURIComponent(machine)}`);
    if (!res.ok) return setMsg({ t: "No se pudo cargar la hoja.", bad: true });
    const j = await res.json();
    setRows(j.rows); setTeam(j.team); setLeader(j.leader); setSupervisor(j.supervisor); setSigned(j.signed);
  }, [day, machine, isMulti]);
  useEffect(() => { load(); }, [load]);

  const set = (i: number, k: keyof Row) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setRows((rs) => rs.map((x, j) => (j === i ? { ...x, [k]: e.target.value } : x)));

  async function save(sign: boolean) {
    if (sign && r.hasErrors) return setMsg({ t: "Corrige los batches en rojo antes de firmar y enviar.", bad: true });
    if (sign && (!leader.trim() || !supervisor.trim())) return setMsg({ t: "Escribe el nombre del líder y del supervisor para firmar.", bad: true });
    setBusy(true); setMsg(null);
    try {
      const res = await fetch("/api/capture", { method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ day, machine, team, leader, supervisor, rows, sign }) });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) return setMsg({ t: j.error ?? "No se pudo guardar.", bad: true });
      setSigned(j.signed);
      setMsg({ t: sign ? "Hoja firmada y enviada." : "Borrador guardado." });
    } finally { setBusy(false); }
  }

  const Num = ({ i, k, w, mode = "decimal" }: { i: number; k: keyof Row; w: number; mode?: "decimal" | "numeric" }) => (
    <input className="input" inputMode={mode} style={cell(w)} value={rows[i][k]} onChange={set(i, k)} disabled={locked} aria-label={`${k} batch ${i + 1}`} />
  );

  return (
    <>
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "flex-end", gap: "12px 24px" }}>
        <div style={{ flex: "1 1 260px", minWidth: 0 }}>
          <div className="kicker">{role === "Operador" ? "Captura" : "Empaque"}{signed ? " · hoja firmada" : ""}</div>
          <h1 style={{ margin: 0, fontSize: 44, lineHeight: 1.05 }}>Registro Envasado</h1>
        </div>
        {!isMulti && (
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-secondary" disabled={busy || locked} onClick={() => save(false)}>Guardar borrador</button>
            <button className="btn btn-primary" disabled={busy || locked} onClick={() => save(true)} style={{ whiteSpace: "nowrap" }}>Firmar y enviar</button>
          </div>
        )}
      </div>

      {msg && <div role="status" style={{ padding: 12, fontSize: 14, borderRadius: 10, background: msg.bad ? "#fde3e8" : "#e8f5d6", color: msg.bad ? "#9a0022" : "#2f5f0b" }}>{msg.t}</div>}

      <div className="blueprint" style={{ padding: 18, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,170px),1fr))", gap: 14, alignItems: "end" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}><label htmlFor="c-fecha" style={lab}>Fecha</label>
          <input id="c-fecha" className="input" type="date" value={day} onChange={(e) => e.target.value && setDay(e.target.value)} /></div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}><span style={lab}>Grupo</span>
          <div className="seg" style={{ alignSelf: "flex-start" }}>
            {[1, 2].map((g) => <label key={g} className="seg-opt"><input type="radio" name="grp" checked={team === g} onChange={() => setTeam(g)} disabled={locked} />Grupo {g}</label>)}
          </div></div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}><label htmlFor="c-maq" style={lab}>Máquina</label>
          <select id="c-maq" className="input" value={machine} onChange={(e) => setMachine(e.target.value)}>
            {CAPTURE_MACHINES.map((m) => <option key={m}>{m}</option>)}</select></div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}><label htmlFor="c-lid" style={lab}>Nombre del líder</label>
          <input id="c-lid" className="input" value={leader} onChange={(e) => setLeader(e.target.value)} disabled={locked} /></div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}><label htmlFor="c-sup" style={lab}>Supervisor</label>
          <input id="c-sup" className="input" value={supervisor} onChange={(e) => setSupervisor(e.target.value)} disabled={locked} /></div>
      </div>

      {isMulti ? (
        <div className="blueprint" style={{ padding: 28 }}>
          <div className="kicker">Pendiente</div>
          <h2 style={{ fontSize: 28 }}>Multivac se captura por hora</h2>
          <p className="muted" style={{ margin: 0 }}>La captura por hora y por producto de Multivac aún no está implementada. Las demás máquinas capturan por batch.</p>
        </div>
      ) : (<>
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
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
            <div className="card-title" style={{ fontSize: 19 }}>Batches</div>
            <span className="muted" style={{ fontSize: 12 }}>Horas esperadas según Configuración · {machine}. El resto se calcula.</span>
          </div>
          <table className="table" style={{ minWidth: 1100 }}>
            <thead><tr>
              <th>Batch</th><th>Esperada</th><th>Hora real término</th><th style={{ textAlign: "right" }}>Retraso</th>
              {showPar && <th style={{ textAlign: "right" }}>Paro por MTO. (min)</th>}
              <th style={{ textAlign: "right" }}>Kg fundidos</th><th style={{ textAlign: "right" }}>Peso prom. pieza (kg)</th>
              <th style={{ textAlign: "right" }}>Pzs empacadas</th><th style={{ textAlign: "right" }}>Total kg</th>
              <th style={{ textAlign: "right" }}>Merma (kg)</th><th style={{ textAlign: "right" }}>Total + merma</th>
              <th style={{ textAlign: "right" }}>Rendim.</th><th style={{ textAlign: "right" }}>Kg desecho</th><th style={{ textAlign: "right" }}>% desecho</th>
            </tr></thead>
            <tbody>
              {r.calc.map((c) => { const i = c.n - 1; return (
                <tr key={c.n}>
                  <td>{c.n}</td><td>{c.exp}</td>
                  <td><input className="input" type="time" style={{ width: 104, padding: "4px 6px", minHeight: 30 }} value={rows[i].real} onChange={set(i, "real")} disabled={locked} aria-label={`hora real batch ${c.n}`} /></td>
                  <td style={{ textAlign: "right" }}><span style={pill(c.retSem)}>{c.retTxt}</span></td>
                  {showPar && <td style={{ textAlign: "right" }}>{Num({ i, k: "paro", w: 72, mode: "numeric" })}</td>}
                  <td style={{ textAlign: "right" }}>{Num({ i, k: "kg", w: 72 })}</td>
                  <td style={{ textAlign: "right" }}>{Num({ i, k: "peso", w: 72 })}</td>
                  <td style={{ textAlign: "right" }}>{Num({ i, k: "pzs", w: 76, mode: "numeric" })}</td>
                  <td style={{ textAlign: "right" }}>{c.tot}</td>
                  <td style={{ textAlign: "right" }}>{Num({ i, k: "mer", w: 72 })}</td>
                  <td style={{ textAlign: "right" }}>{c.tm}</td>
                  <td style={{ textAlign: "right" }}><span style={pill(c.rendWarn ? A : null)}>{c.rend}</span></td>
                  <td style={{ textAlign: "right" }}>{c.des}</td><td style={{ textAlign: "right" }}>{c.pdes}</td>
                </tr>); })}
              <tr style={{ fontWeight: 600 }}>
                <td colSpan={4} style={{ textAlign: "right", letterSpacing: ".08em", textTransform: "uppercase", fontSize: 12 }}>Acumulado</td>
                {showPar && <td style={{ textAlign: "right" }}>{r.acc.paro}</td>}
                <td></td><td></td><td style={{ textAlign: "right" }}>{r.acc.pzs}</td><td style={{ textAlign: "right" }}>{r.acc.tot}</td>
                <td style={{ textAlign: "right" }}>{r.acc.mer}</td><td style={{ textAlign: "right" }}>{r.acc.tm}</td>
                <td style={{ textAlign: "right" }}>{r.acc.rend}</td><td style={{ textAlign: "right" }}>{r.acc.des}</td><td style={{ textAlign: "right" }}>{r.acc.pdes}</td>
              </tr>
            </tbody>
          </table>
          {!TARGET_WEIGHT_G[machine] && <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>Sin peso objetivo configurado para {machine}.</div>}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {r.warns.map((w, i) => (
            <div key={i} style={{ padding: "10px 12px", fontSize: 13, background: w.s.t, color: w.s.i, border: `1px solid ${w.s.c}` }}>
              <strong style={{ fontWeight: 600 }}>{w.h}</strong> {w.m}
            </div>
          ))}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,260px),1fr))", gap: 16 }}>
          {[["Responsable operativo", leader], ["Supervisor", supervisor]].map(([t, v]) => (
            <div key={t} className="blueprint" style={{ padding: 16, display: "flex", flexDirection: "column", gap: 6 }}>
              <span style={lab}>{t}</span>
              <div style={{ fontFamily: "var(--font-heading)", fontSize: 22, borderBottom: "1px solid var(--color-text)", paddingBottom: 4, minHeight: 28 }}>{v}</div>
              <span style={lab}>Nombre y firma</span>
            </div>
          ))}
        </div>
      </>)}
    </>
  );
}
