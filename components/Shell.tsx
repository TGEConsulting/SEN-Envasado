"use client";

import { useState } from "react";
import {
  DAYS, DAY_LABEL, MACHINE_TABS, ROLES, ROLE_LABEL, TAB_LABEL,
  type Day, type Role, type TabId,
} from "@/lib/domain";
import Tablero from "./Tablero";
import Users from "./Users";

const ORDER = ["tablero", "focos", "tend", "env", "ent", "cap", "datos", "rep", "bit", "config", "users"] as const;
const GROUP: Record<string, number> = { tablero: 1, focos: 1, tend: 1, env: 2, ent: 2, cap: 3, datos: 3, rep: 3, bit: 3, config: 3, users: 3 };

export default function Shell({ role, meId }: { role: Role; meId: number }) {
  const [tabState, setTab] = useState<TabId>("tablero");
  const [day, setDay] = useState<Day>(16);

  const signOut = async () => { await fetch("/api/auth/signout", { method: "POST" }); window.location.href = "/"; };

  const allowed = ROLES[role];
  const tab = allowed.includes(tabState) ? tabState : allowed[0];
  const envAllowed = MACHINE_TABS.filter((t) => allowed.includes(t));
  const inEnv = MACHINE_TABS.includes(tab);
  const prim = ORDER.filter((t) => (t === "env" ? envAllowed.length > 0 : allowed.includes(t as TabId)));
  const goPrim = (t: string) => setTab(t === "env" ? (envAllowed.includes(tab) ? tab : envAllowed[0]) : (t as TabId));
  const labelOf = (t: string) =>
    t === "env" ? "Envasado" : t === "datos" && role === "Supervisor" ? "Entregas" : TAB_LABEL[t as TabId];
  const showDays = tab === "tablero";

  return (
    <div style={{ minHeight: "100vh", padding: "16px 16px 48px" }}>
      <div className="blueprint" style={{ maxWidth: 1280, margin: "0 auto", overflow: "hidden", borderRadius: 18 }}>
        <div className="stripe" style={{ margin: "-2px -2px 0" }} />

        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "12px 24px", padding: "28px 28px 0" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
            <img src="/logo-color.png" alt="La Quinta" style={{ height: 52, width: "auto" }} />
            <span style={{ display: "flex", flexDirection: "column", lineHeight: 1.1, gap: 2 }}>
              <span style={{ fontFamily: "var(--font-heading)", fontWeight: 800, fontSize: 30, color: "#0d4884" }}>SEN</span>
              <span className="muted" style={{ fontSize: 13, fontWeight: 500 }}>Sistema de Envasado</span>
            </span>
            <span className="tag">{ROLE_LABEL[role]}</span>
            <button className="btn btn-secondary btn-sm" onClick={signOut}>Salir</button>
          </div>
          {showDays && (
            <div style={{ display: "flex", overflowX: "auto", maxWidth: "100%", gap: 6 }}>
              {DAYS.map((d) => (
                <button key={d} onClick={() => setDay(d)} aria-pressed={d === day}
                  style={{ cursor: "pointer", font: "inherit", fontSize: 13, flex: "none", whiteSpace: "nowrap", padding: "6px 10px",
                    border: `1px solid ${d === day ? "#0d4884" : "var(--color-divider)"}`,
                    background: d === day ? "#0d4884" : "transparent", color: d === day ? "#fff" : "var(--color-text)" }}>
                  {DAY_LABEL[d]}
                </button>
              ))}
            </div>
          )}
        </div>

        <nav aria-label="Secciones" style={{ display: "flex", flexWrap: "wrap", gap: "2px 4px", padding: "14px 28px 0", borderBottom: "1px solid var(--color-divider)", marginTop: 6 }}>
          {prim.map((t, i) => {
            const active = t === "env" ? inEnv : t === tab;
            const newGroup = i > 0 && GROUP[t] !== GROUP[prim[i - 1]];
            return (
              <button key={t} onClick={() => goPrim(t)} aria-current={active ? "page" : undefined}
                style={{ cursor: "pointer", whiteSpace: "nowrap", background: "none", font: "inherit", fontWeight: 600, fontSize: 16,
                  padding: "10px 14px", border: 0, borderBottom: `4px solid ${active ? "#149bd8" : "transparent"}`,
                  borderLeft: newGroup ? "2px solid #cfe2f5" : 0, marginLeft: newGroup ? 8 : 0,
                  color: active ? "#0d4884" : "var(--color-neutral-700)" }}>
                {labelOf(t)}
              </button>
            );
          })}
        </nav>

        {inEnv && envAllowed.length > 1 && (
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, padding: "12px 28px", background: "#f6faff", borderBottom: "1px solid var(--color-divider)" }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: "#0d4884", marginRight: 4 }}>Máquina</span>
            {envAllowed.map((t) => (
              <button key={t} onClick={() => setTab(t)} aria-pressed={t === tab}
                style={{ cursor: "pointer", font: "inherit", fontSize: 15, fontWeight: 600, whiteSpace: "nowrap", padding: "8px 16px", minHeight: 40,
                  borderRadius: 999, border: "2px solid #0d4884", background: t === tab ? "#0d4884" : "#fff", color: t === tab ? "#fff" : "#0d4884" }}>
                {TAB_LABEL[t]}
              </button>
            ))}
          </div>
        )}

        <main style={{ padding: 28, display: "flex", flexDirection: "column", gap: 20 }}>
          {tab === "tablero" ? (
            <Tablero day={day} canOpen={(t) => allowed.includes(t)} onOpen={setTab} />
          ) : tab === "users" ? (
            <Users meId={meId} />
          ) : (
            <div className="blueprint" style={{ padding: 28 }}>
              <div className="kicker">Pendiente</div>
              <h2 style={{ fontSize: 28 }}>{labelOf(tab)}</h2>
              <p className="muted" style={{ margin: 0 }}>Esta sección del diseño aún no está implementada.</p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
