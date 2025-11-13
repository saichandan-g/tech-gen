// lib/postgres.ts
import { Pool } from "pg"

const POSTGRES_URI = process.env.POSTGRES_URI
if (!POSTGRES_URI) {
  throw new Error("Please define POSTGRES_URI in .env.local")
}

let cached = (global as any).__pgPool as { pool: Pool } | undefined
if (!cached) cached = (global as any).__pgPool = { pool: new Pool({ connectionString: POSTGRES_URI, ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false }) }

export function getPool() {
  return cached!.pool
}
