import type { Params } from "./reportes";

export const CAN_VIEW_REPORTS = ["Dirección", "Gerencia", "Administrador"];
const isDay = (d: unknown): d is string => typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d) && !isNaN(Date.parse(d));

export function readParams(u: URL): Params | null {
  const day = u.searchParams.get("day");
  if (!isDay(day)) return null;
  return { day, machine: u.searchParams.get("machine") ?? "Tecnovac", product: parseInt(u.searchParams.get("product") ?? "", 10) || 0, process: u.searchParams.get("process") ?? "all" };
}
