export type Cell = string | number;
export type ReportData = { id: string; name: string; sheet: string; sub: string; head: string[]; rows: Cell[][] };
export type Params = { day: string; machine: string; product: number; process: string };

export const REPORT_LIST = [
  { id: "tablero", label: "Resumen del día" }, { id: "entregas", label: "Entregas de PT por artículo" },
  { id: "empaque", label: "Empaque contra programa" }, { id: "batches", label: "Batches / empaque por hora" },
  { id: "programas", label: "Programas de empaque y entregas" }, { id: "bitacora", label: "Bitácora de cambios" },
] as const;
export const REPORT_MACHINES = ["Tecnovac", "Termo MK", "Embolsado", "Polar", "Multivac"] as const;

