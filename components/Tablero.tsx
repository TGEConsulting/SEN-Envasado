import { DAY_DATA, DAY_LABEL, MONTH_TO_DATE, MULTIVAC_PRODUCTS, A, G, R, n0, pct, sem, type Day, type TabId } from "@/lib/domain";

type Card = { title: string; big: string; bigLabel: string; st: ReturnType<typeof sem>; tab: TabId; lines: { a: string; b: string }[]; foot: string };

function cardsFor(day: Day): Card[] {
  const d = DAY_DATA[day], e = d.ent, m = d.mol, is16 = day === 16;
  return [
    {
      title: "Entregas de PT", big: e ? pct(e.f) : "—", bigLabel: "Fill rate", st: sem(e?.f), tab: "ent",
      lines: e
        ? [{ a: "Cumplimiento en volumen", b: pct(e.v) }, { a: "SKUs completos", b: is16 ? "13 de 23" : pct(e.s) },
           { a: "Piezas faltantes", b: is16 ? "10,153" : "—" }, { a: "Piezas excedentes", b: is16 ? "4,144" : "—" }]
        : [{ a: "Sin registro de entregas", b: "" }],
      foot: e ? `Programadas ${n0(e.prog)} · entregadas ${n0(e.ent)}` : "",
    },
    {
      title: "Multivac", big: pct(d.ter[3]), bigLabel: "Cumplimiento", st: sem(d.ter[3]), tab: "ter",
      lines: MULTIVAC_PRODUCTS.map((x, i) => ({ a: x, b: pct(d.ter[i]) })),
      foot: is16 ? "Programa 54,904 · logrado 56,729" : "",
    },
    {
      title: "Tecnovac", big: m ? pct(m.c) : "—", bigLabel: "Cumplimiento", st: sem(m?.c), tab: "mol",
      lines: m
        ? [{ a: "Batches a tiempo", b: is16 ? "25% (3 de 12)" : pct(m.t) }, { a: "Rendimiento", b: pct(m.r) },
           { a: "Desecho", b: pct(m.d) }, { a: "Sobrepeso vs 250 g", b: "+" + (m.s * 100).toFixed(1) + "%" }]
        : [{ a: "Sin registro", b: "" }],
      foot: m ? (is16 ? "Pedido 13,800 · empacado 13,410 · Grupo 2" : `Empacado ${n0(m.p)} · ${m.g}`) : "",
    },
    ...(["Termo MK", "Embolsado", "Polar"] as const).map((title, i): Card => ({
      title, big: "—", bigLabel: "Cumplimiento", st: sem(null), tab: (["mk", "embo", "vac"] as const)[i],
      lines: [{ a: "Programa de empaque", b: "—" }, { a: "Empacado", b: "Sin captura" }], foot: "",
    })),
  ];
}

function headline(day: Day) {
  const d = DAY_DATA[day];
  if (day === 16) return "Multivac y Tecnovac cerca del programa; entregas de PT con faltante concentrado en un SKU";
  return `Multivac ${pct(d.ter[3])}` + (d.ent ? ` · entregas ${pct(d.ent.f)} fill rate` : " · sin registro de entregas") + (d.mol ? ` · Tecnovac ${pct(d.mol.c)}` : "");
}

export default function Tablero({ day, canOpen, onOpen }: { day: Day; canOpen: (t: TabId) => boolean; onOpen: (t: TabId) => void }) {
  const label = DAY_LABEL[day] + "/oct";
  return (
    <>
      <div>
        <div className="kicker">Jornada {label}</div>
        <h1 style={{ margin: 0, fontSize: 44, lineHeight: 1.05, maxWidth: 900, textWrap: "pretty" }}>{headline(day)}</h1>
      </div>

      <div className="grid-auto">
        {cardsFor(day).map((c) => {
          const open = canOpen(c.tab);
          return (
            <div key={c.title} className="blueprint" role={open ? "button" : undefined} tabIndex={open ? 0 : undefined}
              onClick={open ? () => onOpen(c.tab) : undefined}
              onKeyDown={open ? (ev) => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); onOpen(c.tab); } } : undefined}
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
          Mes a la fecha · 1–16 oct
        </div>
        {MONTH_TO_DATE.map((m) => (
          <div key={m.a} style={{ padding: "12px 16px", borderLeft: "1px solid var(--color-divider)" }}>
            <div className="muted" style={{ fontSize: 11, letterSpacing: ".08em", textTransform: "uppercase" }}>{m.a}</div>
            <div style={{ fontFamily: "var(--font-heading)", fontWeight: 600, fontSize: 26 }}>{m.b}</div>
          </div>
        ))}
      </div>

      <div className="muted" style={{ display: "flex", flexWrap: "wrap", gap: 16, fontSize: 12, alignItems: "center" }}>
        <span>Semáforo</span>
        {[[G, "verde ≥ 95%"], [A, "amarillo 85–95%"], [R, "rojo < 85%"]].map(([s, t]) => (
          <span key={t as string} style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
            <span className="dot" style={{ width: 10, height: 10, background: (s as typeof G).c }} />{t as string}
          </span>
        ))}
      </div>
    </>
  );
}
