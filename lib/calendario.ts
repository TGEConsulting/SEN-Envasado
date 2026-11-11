// Calendario operativo del libro: se opera de lunes a sábado; el domingo no es operativo.
const D = (iso: string) => new Date(iso + "T12:00:00Z");
const iso = (d: Date) => d.toISOString().slice(0, 10);

export const addDays = (s: string, n: number) => { const d = D(s); d.setUTCDate(d.getUTCDate() + n); return iso(d); };
export const dow = (s: string) => D(s).getUTCDay(); // 0 = domingo
export const isOperating = (s: string) => dow(s) !== 0;
export const eachDay = (from: string, to: string) => { const out: string[] = []; for (let d = from; d <= to; d = addDays(d, 1)) out.push(d); return out; };
export const DAY_NAMES = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
export const dayName = (s: string) => DAY_NAMES[dow(s)];

// Semana ISO (S45 = lunes 2 al sábado 7 de noviembre de 2026).
export function isoWeek(s: string): number {
  const d = D(s); const day = (d.getUTCDay() + 6) % 7; // lunes = 0
  d.setUTCDate(d.getUTCDate() - day + 3); // jueves de esa semana
  const first = new Date(Date.UTC(d.getUTCFullYear(), 0, 4, 12));
  return 1 + Math.round(((d.getTime() - first.getTime()) / 86400000 - 3 + ((first.getUTCDay() + 6) % 7)) / 7);
}
// Lunes a sábado de la semana que contiene `s`; el último tramo del mes termina el día 30/31.
export function weekRange(s: string) {
  const mon = addDays(s, -((dow(s) + 6) % 7));
  return { from: mon, to: addDays(mon, 5), label: "S" + isoWeek(mon) };
}
export function monthRange(s: string) {
  const [y, m] = s.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { from: `${y}-${String(m).padStart(2, "0")}-01`, to: `${y}-${String(m).padStart(2, "0")}-${String(last).padStart(2, "0")}` };
}
// Hoy en la hora de Ciudad de México (YYYY-MM-DD).
export const todayMX = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Mexico_City" });
