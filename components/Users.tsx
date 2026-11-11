"use client";

import { useCallback, useEffect, useState } from "react";
import { ROLES, ROLE_LABEL, type Role } from "@/lib/domain";

type U = { id: number; email: string; role: string; status: "invitado" | "activo" };
const lab: React.CSSProperties = { fontSize: 13, fontWeight: 600, color: "#0d4884" };

export default function Users({ meId }: { meId: number }) {
  const [users, setUsers] = useState<U[]>([]);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("Operador");
  const [msg, setMsg] = useState<{ t: string; bad?: boolean } | null>(null);

  const load = useCallback(async () => {
    const r = await fetch("/api/users");
    if (r.ok) setUsers((await r.json()).users);
  }, []);
  useEffect(() => { load(); }, [load]);

  async function invite() {
    setMsg(null);
    const r = await fetch("/api/users", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, role }) });
    const j = await r.json().catch(() => ({}));
    if (r.ok) { setEmail(""); setMsg({ t: "Invitación registrada. La persona activa su cuenta en «Activar invitación»." }); load(); }
    else setMsg({ t: j.error ?? "No se pudo invitar.", bad: true });
  }
  async function remove(u: U) {
    if (!confirm(`¿Quitar a ${u.email}?`)) return;
    const r = await fetch(`/api/users?id=${u.id}`, { method: "DELETE" });
    if (!r.ok) setMsg({ t: (await r.json().catch(() => ({}))).error ?? "No se pudo quitar.", bad: true });
    load();
  }

  return (
    <>
      <div>
        <div style={{ fontSize: 12, marginBottom: 6, fontWeight: 600, color: "#0b6a9a" }}>Administración</div>
        <h1 style={{ margin: 0, fontSize: 44, lineHeight: 1.05, color: "#0d4884" }}>Usuarios e invitaciones</h1>
      </div>
      <form className="blueprint" onSubmit={(e) => { e.preventDefault(); invite(); }}
        style={{ padding: 18, display: "flex", flexWrap: "wrap", gap: 12, alignItems: "flex-end" }}>
        <div style={{ flex: "2 1 240px", display: "flex", flexDirection: "column", gap: 4 }}>
          <label htmlFor="inv-em" style={lab}>Correo a invitar</label>
          <input id="inv-em" className="input" type="email" placeholder="nombre@lacteoslaquinta.com.mx" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div style={{ flex: "1 1 200px", display: "flex", flexDirection: "column", gap: 4 }}>
          <label htmlFor="inv-rol" style={lab}>Rol</label>
          <select id="inv-rol" className="input" value={role} onChange={(e) => setRole(e.target.value as Role)}>
            {(Object.keys(ROLES) as Role[]).map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
          </select>
        </div>
        <button className="btn btn-primary" type="submit">Enviar invitación</button>
      </form>
      {msg && <div role="status" style={{ padding: 12, fontSize: 14, borderRadius: 10, background: msg.bad ? "#fde3e8" : "#e8f5d6", color: msg.bad ? "#9a0022" : "#2f5f0b" }}>{msg.t}</div>}
      <div className="blueprint" style={{ padding: 16, overflowX: "auto" }}>
        <table className="table" style={{ minWidth: 520 }}>
          <thead><tr><th>Correo</th><th>Rol</th><th>Estado</th><th></th></tr></thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>{u.email}</td><td>{u.role}</td>
                <td><span className="chip" style={{ background: u.status === "activo" ? "#e8f5d6" : "#fff2cc", color: u.status === "activo" ? "#2f5f0b" : "#7a5200" }}>{u.status === "activo" ? "Activo" : "Invitado"}</span></td>
                <td style={{ textAlign: "right" }}>{u.id !== meId && <button className="btn btn-secondary btn-sm" onClick={() => remove(u)}>Quitar</button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
