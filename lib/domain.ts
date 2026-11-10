// Dominio de SEN: roles, pestañas, semáforo y datos de ejemplo del tablero (12–16 oct 2026).

export type Role = "Dirección" | "Gerencia" | "Planeador" | "Administrador" | "Supervisor" | "Operador";
export type TabId =
  | "tablero" | "ent" | "ter" | "mol" | "mk" | "embo" | "vac" | "cap" | "datos"
  | "focos" | "tend" | "rep" | "bit" | "config" | "users";

export const ROLES: Record<Role, TabId[]> = {
  Dirección: ["tablero", "tend", "focos", "rep", "bit"],
  Gerencia: ["tablero", "ent", "ter", "mol", "mk", "embo", "vac", "datos", "focos", "tend", "rep", "bit", "config"],
  Supervisor: ["ter", "mol", "mk", "embo", "vac", "cap", "datos"],
  Operador: ["cap"],
  Planeador: ["datos"],
  Administrador: ["tablero", "ent", "ter", "mol", "mk", "embo", "vac", "cap", "datos", "focos", "tend", "rep", "bit", "config", "users"],
};

export const ROLE_LABEL: Record<Role, string> = {
  Dirección: "Dirección",
  Gerencia: "Gerencia de producción",
  Supervisor: "Supervisor · Grupo 2",
  Operador: "Operador capturista",
  Planeador: "Planeador",
  Administrador: "Administrador",
};

export const TAB_LABEL: Record<TabId, string> = {
  tablero: "Tablero", ent: "Entregas PT", ter: "Multivac", mol: "Tecnovac", mk: "Termo MK",
  embo: "Embolsado", vac: "Polar", cap: "Empaque", datos: "Datos", bit: "Bitácora",
  users: "Usuarios", rep: "Reportes", config: "Configuración", focos: "Focos", tend: "Tendencia",
};

export const MACHINE_TABS: TabId[] = ["ter", "mol", "mk", "embo", "vac"];

// Semáforo (definido por el cliente): verde ≥ 98 %, amarillo 95–98 %, rojo < 95 %.
export type Sem = { c: string; t: string; i: string; l: string };
export const G: Sem = { c: "#5aa31a", t: "#e8f5d6", i: "#2f5f0b", l: "Verde" };
export const A: Sem = { c: "#f2a900", t: "#fff2cc", i: "#7a5200", l: "Amarillo" };
export const R: Sem = { c: "#db0030", t: "#fde3e8", i: "#9a0022", l: "Rojo" };
export const N: Sem = { c: "#8a97a8", t: "#e3eaf2", i: "#323c4d", l: "Sin dato" };

export const sem = (v: number | null | undefined): Sem =>
  v == null ? N : v >= 0.98 ? G : v >= 0.95 ? A : R;
export const pct = (v: number | null | undefined) => (v == null ? "—" : (v * 100).toFixed(1) + "%");
export const n0 = (n: number) => Math.round(n).toLocaleString("en-US");

// Fechas ISO (YYYY-MM-DD) → etiquetas en español.
const D = (iso: string) => new Date(iso + "T12:00:00Z");
export const dayChip = (iso: string) => D(iso).toLocaleDateString("es-MX", { weekday: "short", day: "2-digit", timeZone: "UTC" }).replace(".", "");
export const dayLong = (iso: string) => D(iso).toLocaleDateString("es-MX", { weekday: "short", day: "2-digit", month: "short", timeZone: "UTC" }).replace(/\./g, "");
export const monthLabel = (iso: string) => D(iso).toLocaleDateString("es-MX", { month: "long", year: "numeric", timeZone: "UTC" });
export const monthStartLabel = (iso: string) => "1–" + D(iso).toLocaleDateString("es-MX", { day: "numeric", month: "short", timeZone: "UTC" }).replace(/\./g, "");

// Proceso por defecto de un artículo nuevo (regla del prototipo); el planeador lo ajusta en Datos.
export type Process = "Tecnovac" | "Multivac" | "Termo MK" | "Embolsado" | "Polar";
export const PROCESSES: Process[] = ["Tecnovac", "Multivac", "Termo MK", "Embolsado", "Polar"];
export const defaultProcess = (id: number): Process =>
  id === 10100 ? "Tecnovac"
  : [2135, 1065, 1073].includes(id) ? "Multivac"
  : id === 6000 || (id >= 2001 && id <= 2190 && id !== 2135) ? "Polar"
  : "Embolsado";
