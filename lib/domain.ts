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

// Semáforo: verde ≥ 95 %, amarillo 85–95 %, rojo < 85 %.
export type Sem = { c: string; t: string; i: string; l: string };
export const G: Sem = { c: "#5aa31a", t: "#e8f5d6", i: "#2f5f0b", l: "Verde" };
export const A: Sem = { c: "#f2a900", t: "#fff2cc", i: "#7a5200", l: "Amarillo" };
export const R: Sem = { c: "#db0030", t: "#fde3e8", i: "#9a0022", l: "Rojo" };
export const N: Sem = { c: "#8a97a8", t: "#e3eaf2", i: "#323c4d", l: "Sin dato" };

export const sem = (v: number | null | undefined): Sem =>
  v == null ? N : v >= 0.95 ? G : v >= 0.85 ? A : R;
export const pct = (v: number | null | undefined) => (v == null ? "—" : (v * 100).toFixed(1) + "%");
export const n0 = (n: number) => Math.round(n).toLocaleString("en-US");

export type Day = 12 | 13 | 14 | 15 | 16;
export const DAYS: Day[] = [12, 13, 14, 15, 16];
export const DAY_LABEL: Record<Day, string> = { 12: "lun 12", 13: "mar 13", 14: "mié 14", 15: "jue 15", 16: "vie 16" };

type Ent = { v: number; f: number; s: number; prog: number; ent: number };
type Mol = { c: number; r: number; d: number; s: number; t: number; p: number; g: string };
export type DayData = { ent: Ent | null; ter: [number, number, number, number]; mol: Mol | null };

// Datos de ejemplo tomados del prototipo; se reemplazan por consultas a Neon.
export const DAY_DATA: Record<Day, DayData> = {
  12: { ent: null, ter: [1.099, 0.927, 0.891, 0.963], mol: null },
  13: { ent: null, ter: [0.555, 0.951, 1.026, 0.86], mol: { c: 0.899, r: 1.006, d: 0.0127, s: 0.0459, t: 0.091, p: 12412, g: "Sin registro" } },
  14: { ent: { v: 0.865, f: 0.815, s: 0.4, prog: 98802, ent: 85504 }, ter: [0.924, 1.019, 0.417, 0.865], mol: { c: 0.857, r: 1.004, d: 0.0043, s: 0.0566, t: 0.182, p: 11829, g: "Grupo 2" } },
  15: { ent: { v: 1.206, f: 0.982, s: 0.476, prog: 94937, ent: 114529 }, ter: [0.996, 1.011, 1.383, 1.101], mol: { c: 0.994, r: 0.996, d: 0.0154, s: 0.0429, t: 0, p: 13723, g: "Grupo 1" } },
  16: { ent: { v: 0.936, f: 0.891, s: 0.565, prog: 93289, ent: 87280 }, ter: [1.061, 1.04, 0.99, 1.033], mol: { c: 0.972, r: 1.022, d: 0.01, s: 0.0577, t: 0.25, p: 13410, g: "Grupo 2" } },
};

export const MULTIVAC_PRODUCTS = ["Oaxaca 400 g", "Panela 300 g", "Ranchero 220 g"];

export const MONTH_TO_DATE = [
  { a: "Entregas", b: "100.1% vol · 89.5% fill" },
  { a: "Multivac", b: "96.4%" },
  { a: "Piezas entregadas", b: "287,313 de 287,028" },
];
