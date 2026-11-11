import { sql } from "./db";
import { eachDay, todayMX } from "./calendario";
import { summarizePeriod, type ArticleMeta, type DayData, type Periodo } from "./periodo";

type Db = ReturnType<typeof sql>;

// Catálogo en el orden del libro (columna `ord`); los artículos nuevos van al final.
export async function loadCatalog(db: Db): Promise<ArticleMeta[]> {
  const r = await db`select id, description, pesaje, formula, short_name from articles order by coalesce(ord, 1000 + id), id`;
  return r.map((a) => ({ id: Number(a.id), description: String(a.description).trim(), pesaje: a.pesaje == null ? null : Number(a.pesaje), formula: a.formula, short: a.short_name }));
}

// Periodo (semana o mes) con el corte indicado; por omisión, el menor entre hoy y el fin del periodo.
export async function loadPeriodo(db: Db, from: string, to: string, corte?: string): Promise<{ periodo: Periodo; catalog: ArticleMeta[] }> {
  const cut = corte ?? (todayMX() < to ? todayMX() : to);
  const [catalog, progs, packed, deliv, inv] = await Promise.all([
    loadCatalog(db),
    db`select to_char(day,'YYYY-MM-DD') as d, kind, article_id, qty from programs where day between ${from}::date and ${to}::date`,
    db`select to_char(day,'YYYY-MM-DD') as d, article_id, qty from packed where day between ${from}::date and ${to}::date`,
    db`select to_char(day,'YYYY-MM-DD') as d, article_id, qty from deliveries where day between ${from}::date and ${to}::date`,
    db`select to_char(day,'YYYY-MM-DD') as d, article_id, qty from inventory where day between ${from}::date and ${to}::date`,
  ]);
  const days: Record<string, DayData> = Object.fromEntries(eachDay(from, to).map((d) => [d, { articles: {}, hasData: false }]));
  const art = (d: string, id: number) => (days[d].articles[id] ??= { progE: 0, progG: 0, realE: null, realG: null, inv: null });
  for (const r of progs) { const a = art(r.d, Number(r.article_id)); if (r.kind === "empaque") a.progE = Number(r.qty); else a.progG = Number(r.qty); }
  // «Con captura» = hay real capturado (empaque o entregas); un día solo con programa aún está «Sin captura».
  for (const r of packed) { art(r.d, Number(r.article_id)).realE = Number(r.qty); days[r.d].hasData = true; }
  for (const r of deliv) { art(r.d, Number(r.article_id)).realG = Number(r.qty); days[r.d].hasData = true; }
  for (const r of inv) art(r.d, Number(r.article_id)).inv = Number(r.qty);
  return { periodo: summarizePeriod(from, to, cut, catalog, days), catalog };
}
