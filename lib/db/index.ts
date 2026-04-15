import "server-only"

import Database from "better-sqlite3"
import { drizzle } from "drizzle-orm/better-sqlite3"

import * as schema from "./schema"

const dbFile =
  process.env.DATABASE_URL?.startsWith("file:")
    ? process.env.DATABASE_URL.slice("file:".length)
    : "./data/dev.db"

// better-sqlite3 is synchronous and safe to reuse in Node.
const sqlite = new Database(dbFile)

export const db = drizzle(sqlite, { schema })
export { schema }

