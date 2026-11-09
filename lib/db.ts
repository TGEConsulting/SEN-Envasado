import { neon } from "@neondatabase/serverless";

// Cliente SQL de Neon (HTTP, apto para funciones serverless de Vercel).
export function sql() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("Falta DATABASE_URL (cadena de conexión de Neon).");
  return neon(url);
}
