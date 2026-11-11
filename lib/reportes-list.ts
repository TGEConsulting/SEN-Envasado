export type Cell = string | number;
export type Section = { title: string; head: string[]; rows: Cell[][] };
export type ReportData = { id: string; name: string; sheet: string; sub: string; head: string[]; rows: Cell[][]; sections?: Section[] };
export type Params = { day: string; machine: string; product: number; process: string };

export const REPORT_LIST = [
  { id: "tablero", label: "Resumen del día" }, { id: "diario", label: "Programa empaque-entregas del día" },
  { id: "wtd", label: "Resumen semanal (WTD)" }, { id: "mtd", label: "Resumen mensual (MTD)" },
  { id: "pareto_wtd", label: "Pareto 80/20 entregas · semana" }, { id: "pareto_mtd", label: "Pareto 80/20 entregas · mes" },
  { id: "empaque", label: "Empaque contra programa por máquina" }, { id: "batches", label: "Batches / empaque por hora" },
  { id: "bitacora", label: "Bitácora de cambios" },
] as const;
export const REPORT_MACHINES = ["Tecnovac", "Termo MK", "Embolsado", "Polar", "Multivac"] as const;

