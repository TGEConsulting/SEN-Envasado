"use client";

import Link from "next/link";
import { useState } from "react";

type Mode = "signin" | "activate";
type Step = "email" | "code" | "pass";

async function post(url: string, data: unknown) {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
  const j = await res.json().catch(() => ({}));
  return { ok: res.ok, j };
}
const label: React.CSSProperties = { fontSize: 14, fontWeight: 600, color: "#0d4884" };
const h1: React.CSSProperties = { margin: 0, fontSize: 44, lineHeight: 1.05, color: "#0d4884" };
const rules = (pw: string) => [
  { ok: pw.length >= 8, t: "Al menos 8 caracteres" },
  { ok: /[A-Za-z]/.test(pw), t: "Una letra" },
  { ok: /\d/.test(pw), t: "Un número" },
];

export default function LoginForm() {
  const [mode, setMode] = useState<Mode>("signin");
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [code, setCode] = useState("");
  const [role, setRole] = useState("");
  const [devCode, setDevCode] = useState<string | undefined>();
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const go = () => { window.location.href = "/app"; };
  const run = async (fn: () => Promise<void>) => { setErr(""); setBusy(true); try { await fn(); } finally { setBusy(false); } };
  const switchMode = (m: Mode) => { setMode(m); setStep("email"); setErr(""); setPw(""); setPw2(""); setCode(""); };

  const signin = () => run(async () => {
    const r = await post("/api/auth/signin", { email, password: pw });
    r.ok ? go() : setErr(r.j.error ?? "No se pudo ingresar.");
  });
  const sendCode = () => run(async () => {
    const r = await post("/api/auth/request-code", { email });
    if (!r.ok) return setErr(r.j.error ?? "No se pudo enviar el código.");
    setDevCode(r.j.devCode); setCode(""); setStep("code");
  });
  const checkCode = () => run(async () => {
    const r = await post("/api/auth/verify-code", { email, code });
    if (!r.ok) return setErr(r.j.error ?? "Código incorrecto.");
    setRole(r.j.role); setStep("pass");
  });
  const create = () => run(async () => {
    if (pw !== pw2) return setErr("Las contraseñas no coinciden.");
    const r = await post("/api/auth/activate", { email, code, password: pw });
    r.ok ? go() : setErr(r.j.error ?? "No se pudo crear la cuenta.");
  });

  const Err = () => err ? <div role="alert" style={{ padding: 12, fontSize: 14, background: "#fde3e8", color: "#9a0022", borderRadius: 10 }}>{err}</div> : null;
  const tabBtn = (m: Mode, text: string) => (
    <button type="button" onClick={() => switchMode(m)} aria-pressed={mode === m}
      style={{ cursor: "pointer", flex: 1, font: "inherit", fontSize: 15, fontWeight: 600, padding: "12px 8px", border: 0,
        background: mode === m ? "#0d4884" : "#fff", color: mode === m ? "#fff" : "#0d4884" }}>{text}</button>
  );

  return (
    <div style={{ minHeight: "100vh", padding: "16px 16px 48px" }}>
      <div className="blueprint" style={{ maxWidth: 1280, margin: "0 auto", overflow: "hidden", borderRadius: 18 }}>
        <div className="stripe" />
        <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: 28 }}>
          <img src="/logo-color.png" alt="La Quinta" style={{ height: 56, width: "auto" }} />
          <Link className="btn btn-secondary" href="/">Volver</Link>
        </header>
        <div style={{ display: "flex", justifyContent: "center", padding: "0 28px 40px" }}>
          <form onSubmit={(e) => e.preventDefault()} style={{ width: 440, maxWidth: "100%", display: "flex", flexDirection: "column", gap: 18 }}>
            <div style={{ display: "flex", border: "2px solid #0d4884", borderRadius: 12, overflow: "hidden" }}>
              {tabBtn("signin", "Iniciar sesión")}{tabBtn("activate", "Activar invitación")}
            </div>

            {mode === "signin" && (<>
              <h1 style={h1}>Ingresar a SEN</h1>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <label htmlFor="em" style={label}>Correo electrónico</label>
                <input id="em" className="input" type="email" autoComplete="username" placeholder="nombre@laquinta.mx" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <label htmlFor="pw" style={label}>Contraseña</label>
                <input id="pw" className="input" type="password" autoComplete="current-password" placeholder="Tu contraseña" value={pw} onChange={(e) => setPw(e.target.value)} />
              </div>
              <Err />
              <button className="btn btn-primary" style={{ width: "100%" }} disabled={busy} onClick={signin} type="submit">Entrar</button>
              <div className="muted" style={{ fontSize: 14 }}>
                ¿Recibiste una invitación y aún no tienes contraseña?{" "}
                <a href="#" onClick={(e) => { e.preventDefault(); switchMode("activate"); }} style={{ fontWeight: 600 }}>Activa tu cuenta</a>
              </div>
            </>)}

            {mode === "activate" && step === "email" && (<>
              <h1 style={h1}>Activa tu cuenta</h1>
              <p style={{ margin: 0 }}>Escribe el correo al que llegó tu invitación. Te enviaremos un código de 6 dígitos.</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <label htmlFor="em2" style={label}>Correo electrónico</label>
                <input id="em2" className="input" type="email" placeholder="nombre@laquinta.mx" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <Err />
              <button className="btn btn-primary" style={{ width: "100%" }} disabled={busy} onClick={sendCode} type="submit">Enviar código</button>
            </>)}

            {mode === "activate" && step === "code" && (<>
              <h1 style={h1}>Escribe tu código</h1>
              <p style={{ margin: 0 }}>Si <strong>{email}</strong> tiene una invitación, enviamos un código. Vale por 15 minutos.</p>
              {devCode && (
                <div style={{ border: "2px dashed #9fc6e8", borderRadius: 14, padding: 14, background: "#f6faff" }}>
                  <div className="muted" style={{ fontSize: 12, fontWeight: 600 }}>Solo desarrollo local: correo no configurado</div>
                  <div style={{ fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: 34, letterSpacing: ".2em", color: "#0d4884" }}>{devCode}</div>
                </div>
              )}
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <label htmlFor="cd" style={label}>Código de invitación</label>
                <input id="cd" className="input" inputMode="numeric" maxLength={6} placeholder="000000" autoComplete="one-time-code"
                  style={{ fontSize: 24, letterSpacing: ".3em", textAlign: "center" }} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} />
              </div>
              <Err />
              <button className="btn btn-primary" style={{ width: "100%" }} disabled={busy || code.length !== 6} onClick={checkCode} type="submit">Verificar código</button>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                <button type="button" className="btn btn-secondary" disabled={busy} onClick={sendCode}>Reenviar código</button>
                <button type="button" className="btn btn-secondary" onClick={() => { setStep("email"); setErr(""); }}>Usar otro correo</button>
              </div>
            </>)}

            {mode === "activate" && step === "pass" && (<>
              <h1 style={h1}>Crea tu contraseña</h1>
              <p style={{ margin: 0 }}>Con ella entrarás a SEN como <strong>{role}</strong>.</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <label htmlFor="n1" style={label}>Contraseña nueva</label>
                <input id="n1" className="input" type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <label htmlFor="n2" style={label}>Repite la contraseña</label>
                <input id="n2" className="input" type="password" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {rules(pw).map((r) => (
                  <div key={r.t} style={{ fontSize: 14, color: r.ok ? "#2f5f0b" : "var(--color-neutral-700)" }}>
                    <strong style={{ display: "inline-block", width: 18 }}>{r.ok ? "✓" : "•"}</strong>{r.t}
                  </div>
                ))}
              </div>
              <Err />
              <button className="btn btn-primary" style={{ width: "100%" }} disabled={busy} onClick={create} type="submit">Crear cuenta y entrar</button>
            </>)}
          </form>
        </div>
      </div>
    </div>
  );
}
