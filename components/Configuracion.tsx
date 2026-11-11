"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BATCH_MACHINES, CONFIG_MACHINES, MULTIVAC_IDS, MULTIVAC_NAMES, N_BATCHES, defaultConfig, diffConfig, generateTimes,
  type BatchMachine, type Config,
} from "@/lib/config";

const lab: React.CSSProperties = { fontSize: 12, color: "var(--color-neutral-700)" };
const small: React.CSSProperties = { padding: "4px 6px", minHeight: 30 };
const toNum = (v: string) => (v.trim() === "" ? null : Number(v.replace(/[^\d]/g, "")));
const clone = (c: Config): Config => JSON.parse(JSON.stringify(c));

export default function Configuracion() {
  const [base, setBase] = useState<Config>(defaultConfig());
  const [cfg, setCfg] = useState<Config>(defaultConfig());
  const [machine, setMachine] = useState<string>("Tecnovac");
  const [product, setProduct] = useState<number>(MULTIVAC_IDS[0]);
  const [gen, setGen] = useState({ start: "09:05", every: "65", n: "13" });
  const [metaAll, setMetaAll] = useState("");
  const [reason, setReason] = useState("");
  const [msg, setMsg] = useState<{ t: string; bad?: boolean } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const r = await fetch("/api/config");
    if (!r.ok) return setMsg({ t: "No se pudo cargar la configuración.", bad: true });
    const j = await r.json(); setBase(j.config); setCfg(clone(j.config)); setReason("");
  };
  useEffect(() => { load(); }, []);

  const changes = useMemo(() => diffConfig(base, cfg), [base, cfg]);
  const isMulti = machine === "Multivac";
  const bm = machine as BatchMachine;

  const setBatch = (patch: Partial<Config["batch"][BatchMachine]>) =>
    setCfg((c) => ({ ...c, batch: { ...c.batch, [bm]: { ...c.batch[bm], ...patch } } }));
  const setTime = (i: number, v: string) => setBatch({ times: cfg.batch[bm].times.map((t, j) => (j === i ? v : t)) });
  const setMeta = (i: number, v: string) => setBatch({ metas: cfg.batch[bm].metas.map((t, j) => (j === i ? toNum(v) : t)) });
  const setStart = (i: number, v: string) => setCfg((c) => ({ ...c, hourly: { ...c.hourly, starts: c.hourly.starts.map((t, j) => (j === i ? v : t)) } }));
  const setGoal = (i: number, v: string) => setCfg((c) => ({ ...c, hourly: { ...c.hourly, goals: { ...c.hourly.goals, [product]: c.hourly.goals[product].map((t, j) => (j === i ? toNum(v) : t)) } } }));

  function generate() {
    const every = Number(gen.every), n = Number(gen.n);
    if (!/^\d{2}:\d{2}$/.test(gen.start) || !Number.isInteger(every) || every < 1 || every > 600 || !Number.isInteger(n) || n < 1 || n > N_BATCHES)
      return setMsg({ t: `Revisa los datos: hora de inicio, intervalo (1–600 min) y de 1 a ${N_BATCHES} batches.`, bad: true });
    setMsg(null); setBatch({ times: generateTimes(gen.start, every, n) });
  }
  function applyAll() {
    const v = toNum(metaAll);
    if (isMulti) setCfg((c) => ({ ...c, hourly: { ...c.hourly, goals: { ...c.hourly.goals, [product]: Array(c.hourly.starts.length).fill(v) } } }));
    else setBatch({ metas: cfg.batch[bm].times.map((t, i) => (t ? v : cfg.batch[bm].metas[i])) });
  }

  async function save() {
    setMsg(null);
    if (!reason.trim()) return setMsg({ t: "Escribe el motivo del cambio.", bad: true });
    setBusy(true);
    try {
      const r = await fetch("/api/config", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ config: cfg, reason }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) return setMsg({ t: j.error ?? "No se pudo guardar.", bad: true });
      setMsg({ t: `Configuración guardada (${j.changes} cambios).` }); await load();
    } finally { setBusy(false); }
  }

  const was = (a: unknown, b: unknown) => (String(a ?? "") !== String(b ?? "") ? <span style={{ fontSize: 12, color: "var(--color-accent-700)" }}>Antes: {String(a ?? "") || "—"}</span> : null);
  const input = (label: string, el: React.ReactNode) => <div style={{ display: "flex", flexDirection: "column", gap: 4 }}><label style={lab}>{label}</label>{el}</div>;

  return (
    <>
      <div><div className="kicker">Configuración</div><h1 style={{ margin: 0, fontSize: 44, lineHeight: 1.05 }}>Horas esperadas por máquina</h1></div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {CONFIG_MACHINES.map((m) => (
          <button key={m} onClick={() => setMachine(m)} aria-pressed={m === machine}
            style={{ cursor: "pointer", font: "inherit", fontSize: 14, padding: "8px 14px", border: `1px solid ${m === machine ? "#0d4884" : "var(--color-divider)"}`, background: m === machine ? "#0d4884" : "transparent", color: m === machine ? "#fff" : "var(--color-text)" }}>{m}</button>
        ))}
      </div>
      {msg && <div role="status" style={{ padding: 12, fontSize: 14, borderRadius: 10, background: msg.bad ? "#fde3e8" : "#e8f5d6", color: msg.bad ? "#9a0022" : "#2f5f0b" }}>{msg.t}</div>}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,300px),1fr))", gap: 20, alignItems: "start" }}>
        <div className="blueprint" style={{ padding: 18, display: "flex", flexDirection: "column", gap: 14 }}>
          {!isMulti && (<>
            <div className="card-title" style={{ fontSize: 19 }}>Generar horarios · {machine}</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
              {input("Inicio", <input className="input" type="time" value={gen.start} onChange={(e) => setGen({ ...gen, start: e.target.value })} />)}
              {input("Cada (min)", <input className="input" inputMode="numeric" value={gen.every} onChange={(e) => setGen({ ...gen, every: e.target.value })} />)}
              {input("Batches", <input className="input" inputMode="numeric" value={gen.n} onChange={(e) => setGen({ ...gen, n: e.target.value })} />)}
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end" }}><button className="btn btn-secondary" onClick={generate}>Generar</button></div>
          </>)}
          {isMulti && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#0d4884" }}>Meta por producto</div>
              <div style={{ display: "grid", gap: 8 }}>
                {MULTIVAC_IDS.map((id) => (
                  <button key={id} onClick={() => setProduct(id)} aria-pressed={id === product}
                    style={{ cursor: "pointer", font: "inherit", textAlign: "left", padding: "10px 14px", border: "2px solid #0d4884", borderRadius: 12, background: id === product ? "#0d4884" : "#fff", color: id === product ? "#fff" : "#0d4884" }}>
                    <div style={{ fontWeight: 700, fontSize: 16 }}>{MULTIVAC_NAMES[id]}</div><div style={{ fontSize: 12, opacity: 0.85 }}>Artículo {id}</div></button>
                ))}
              </div>
            </div>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label style={lab}>{isMulti ? "Meta de piezas por empacar (todas las horas)" : "Meta de piezas por empacar (todos los batches)"}</label>
            <div style={{ display: "flex", gap: 8 }}>
              <input className="input" inputMode="numeric" placeholder="Sin meta" value={metaAll} onChange={(e) => setMetaAll(e.target.value.replace(/[^\d]/g, ""))} aria-label="meta para todos" />
              <button className="btn btn-secondary" onClick={applyAll} style={{ flex: "none", whiteSpace: "nowrap" }}>{isMulti ? "Aplicar a todas" : "Aplicar a todos"}</button>
            </div>
          </div>
          {!isMulti && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {input("Peso objetivo por pieza (g)", <input className="input" inputMode="numeric" placeholder="Sin meta" value={cfg.batch[bm].weightG ?? ""} onChange={(e) => setBatch({ weightG: toNum(e.target.value) })} />)}
              {input("Tolerancia a tiempo (min)", <input className="input" inputMode="numeric" value={cfg.tolerance} onChange={(e) => setCfg({ ...cfg, tolerance: Number(e.target.value.replace(/[^\d]/g, "")) })} />)}
            </div>
          )}
          <div className="muted" style={{ fontSize: 12 }}>
            {isMulti ? "Multivac se captura por hora, de 08:00 a 23:00. Ajusta la hora de inicio de cada franja (es la misma para los tres productos) y la meta de cada una. La hora final se registra en Captura."
              : "La tolerancia aplica a todas las máquinas. Verde dentro de la tolerancia, amarillo hasta 20 min, rojo después."}
          </div>
        </div>

        <div className="blueprint" style={{ padding: 16, overflowX: "auto" }}>
          {!isMulti ? (<>
            <table className="table" style={{ minWidth: 420 }}>
              <thead><tr><th>Batch</th><th>Hora esperada</th><th style={{ textAlign: "right" }}>Meta de piezas por empacar</th><th></th></tr></thead>
              <tbody>
                {cfg.batch[bm].times.map((t, i) => {
                  const dirty = t !== base.batch[bm].times[i] || cfg.batch[bm].metas[i] !== base.batch[bm].metas[i];
                  return (
                    <tr key={i} style={{ background: dirty ? "#fff2cc" : undefined }}>
                      <td>{i + 1}</td>
                      <td><input className="input" type="time" style={{ ...small, width: 120 }} value={t} onChange={(e) => setTime(i, e.target.value)} aria-label={`hora esperada batch ${i + 1}`} /></td>
                      <td style={{ textAlign: "right" }}><input className="input" inputMode="numeric" placeholder="Sin meta" style={{ ...small, width: 100, textAlign: "right" }} value={cfg.batch[bm].metas[i] ?? ""} onChange={(e) => setMeta(i, e.target.value)} aria-label={`meta batch ${i + 1}`} /></td>
                      <td style={{ display: "flex", flexDirection: "column" }}>{was(base.batch[bm].times[i], t)}{was(base.batch[bm].metas[i], cfg.batch[bm].metas[i])}</td>
                    </tr>);
                })}
              </tbody>
            </table>
            <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>Deja la hora vacía para quitar el batch.</div>
          </>) : (
            <table className="table" style={{ minWidth: 340 }}>
              <thead><tr><th>Hora inicio</th><th style={{ textAlign: "right" }}>Meta de piezas · {MULTIVAC_NAMES[product]}</th><th></th></tr></thead>
              <tbody>
                {cfg.hourly.starts.map((t, i) => {
                  const dirty = t !== base.hourly.starts[i] || cfg.hourly.goals[product][i] !== base.hourly.goals[product][i];
                  return (
                    <tr key={i} style={{ background: dirty ? "#fff2cc" : undefined }}>
                      <td><input className="input" type="time" style={{ ...small, width: 112 }} value={t} onChange={(e) => setStart(i, e.target.value)} aria-label={`hora inicio franja ${i + 1}`} /></td>
                      <td style={{ textAlign: "right" }}><input className="input" inputMode="numeric" style={{ ...small, width: 100, textAlign: "right" }} value={cfg.hourly.goals[product][i] ?? ""} onChange={(e) => setGoal(i, e.target.value)} aria-label={`meta franja ${i + 1}`} /></td>
                      <td style={{ display: "flex", flexDirection: "column" }}>{was(base.hourly.starts[i], t)}{was(base.hourly.goals[product][i], cfg.hourly.goals[product][i])}</td>
                    </tr>);
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "flex-end" }}>
        {changes.length > 0 && (
          <div style={{ flex: 1, minWidth: 220, display: "flex", flexDirection: "column", gap: 4 }}>
            <label htmlFor="cf-motivo" style={lab}>Motivo del cambio · {changes.length} sin guardar (obligatorio)</label>
            <input id="cf-motivo" className="input" placeholder="Ej. cambio de turno" value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
        )}
        <button className="btn btn-primary" disabled={busy || !changes.length} onClick={save}>Guardar configuración</button>
      </div>
    </>
  );
}
