import { readFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";

const url = process.env.DATABASE_URL;
if (!url) { console.error("Falta DATABASE_URL"); process.exit(1); }
const sql = neon(url);
const statements = readFileSync(new URL("../db/schema.sql", import.meta.url), "utf8")
  .split(/;\s*\n/).map((s) => s.trim()).filter(Boolean);
for (const s of statements) await sql.query(s);
console.log(`Esquema aplicado (${statements.length} sentencias).`);
