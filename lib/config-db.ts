import { sql } from "./db";
import { defaultConfig, parseConfig, type Config } from "./config";

type Db = ReturnType<typeof sql>;

// Configuración vigente; si no hay nada guardado (o es inválida) se usan los valores por defecto.
export async function loadConfig(db: Db = sql()): Promise<Config> {
  const rows = await db`select value from settings where key = 'config'`;
  if (!rows[0]) return defaultConfig();
  const p = parseConfig(rows[0].value);
  return p.ok ? p.cfg : defaultConfig();
}
