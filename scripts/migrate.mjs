// Aplica db/schema.sql (idempotente). Se ejecuta antes de cada build; sin DATABASE_URL se omite.
import { readFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";

const url = process.env.DATABASE_URL;
if (!url) { console.warn("[migrate] Sin DATABASE_URL: se omite la migración."); process.exit(0); }
const sql = neon(url);
const statements = readFileSync(new URL("../db/schema.sql", import.meta.url), "utf8")
  .replace(/^--.*$/gm, "")
  .split(/;\s*(?:\n|$)/).map((s) => s.trim()).filter(Boolean);
for (const s of statements) await sql.query(s);
console.log(`[migrate] Esquema aplicado (${statements.length} sentencias).`);
