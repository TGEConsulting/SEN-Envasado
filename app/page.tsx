import Link from "next/link";

const FEATURES = [
  ["Captura por máquina", "Tecnovac, Multivac, Termo MK, Embolsado y Polar, con cálculo automático y validaciones."],
  ["Programas y entregas", "El planeador carga el programa de empaque y de entregas de cada día."],
  ["Tablero con semáforo", "Cumplimiento, rendimiento, desecho y retraso por batch, por proceso."],
  ["Bitácora de cambios", "Cada cambio a programas y horarios queda con usuario, fecha y motivo."],
];
const SAMPLE = [
  ["Multivac", "103.3%", "Verde", "#5aa31a"],
  ["Tecnovac", "97.2%", "Verde", "#5aa31a"],
  ["Entregas PT", "89.1%", "Amarillo", "#f2a900"],
];

export default function Landing() {
  return (
    <div style={{ minHeight: "100vh", padding: "16px 16px 48px" }}>
      <div className="blueprint" style={{ maxWidth: 1280, margin: "0 auto", overflow: "hidden", borderRadius: 18 }}>
        <div className="stripe" />
        <header style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 12, padding: 28 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <img src="/logo-color.png" alt="La Quinta" style={{ height: 56, width: "auto" }} />
            <span style={{ fontFamily: "var(--font-heading)", fontWeight: 800, fontSize: 30, color: "#0d4884" }}>SEN</span>
          </div>
          <Link className="btn btn-primary" href="/app">Ingresar</Link>
        </header>

        <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,320px),1fr))", gap: 28, alignItems: "center", padding: "0 28px 28px" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#0b6a9a" }}>Sistema de Envasado · La Quinta</div>
            <h1 style={{ margin: 0, fontSize: 52, lineHeight: 1.05, color: "#0d4884", textWrap: "pretty" }}>
              El envasado del día, claro desde la primera hora
            </h1>
            <p style={{ margin: 0, fontSize: 17, color: "var(--color-neutral-800)", maxWidth: 520 }}>
              Captura el empaque de cada máquina, compáralo con el programa y entérate al momento de lo que se está quedando atrás.
            </p>
            <div><Link className="btn btn-primary" href="/app">Ingresar con mi correo</Link></div>
            <div style={{ fontSize: 13 }} className="muted">El acceso es solo por invitación.</div>
          </div>
          <div style={{ border: "2px solid #0d4884", borderRadius: 16, padding: 16, background: "#f6faff", display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: 18, color: "#0d4884" }}>Jornada vie 16/oct</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(130px,1fr))", gap: 10 }}>
              {SAMPLE.map(([n, v, l, c]) => (
                <div key={n} style={{ border: "2px solid #9fc6e8", borderRadius: 14, padding: 14, background: "#fff" }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "#0d4884" }}>{n}</div>
                  <div style={{ fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: 36, lineHeight: 1.1 }}>{v}</div>
                  <div className="muted" style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
                    <span className="dot" style={{ width: 10, height: 10, background: c }} />{l}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section style={{ padding: "0 28px 28px", display: "flex", flexDirection: "column", gap: 14 }}>
          <h2 style={{ fontSize: 24, color: "#0d4884", margin: 0 }}>Qué hace SEN</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,220px),1fr))", gap: 14 }}>
            {FEATURES.map(([t, d]) => (
              <div key={t} style={{ border: "2px solid #cfe2f5", borderRadius: 14, padding: 18, display: "flex", flexDirection: "column", gap: 6 }}>
                <div style={{ fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: 19, color: "#0d4884" }}>{t}</div>
                <div style={{ fontSize: 15, color: "var(--color-neutral-800)" }}>{d}</div>
              </div>
            ))}
          </div>
        </section>

        <footer style={{ padding: "12px 28px", background: "#0d4884", color: "#fff", fontSize: 13, display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: "8px 16px" }}>
          <span>La Quinta · Sistema de Envasado · Acceso por invitación</span>
          <a href="https://tgeconsulting.mx/" target="_blank" rel="noopener" style={{ color: "#fff", fontWeight: 600 }}>TGE Consulting</a>
        </footer>
      </div>
    </div>
  );
}
