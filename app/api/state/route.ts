import { inArray } from "drizzle-orm"
import { NextResponse } from "next/server"

import { db, schema } from "@/lib/db"

type UpsertEntry = {
  key: string
  value: string
}

const MANAGED_KEYS = new Set([
  "adminData",
  "camerasData",
  "attendanceRecords",
  "studentDataset",
  "gradesData",
  "behaviorAlerts",
  "currentClass",
  "currentUser",
  "loginTime",
])

function sanitizeKey(value: unknown): string {
  return String(value ?? "").trim()
}

export async function GET() {
  try {
    const rows = db
      .select({
        key: schema.appState.key,
        value: schema.appState.value,
      })
      .from(schema.appState)
      .all()

    const data = Object.fromEntries(rows.map((r) => [r.key, r.value]))
    return NextResponse.json({ ok: true, data })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Failed to load app state" }, { status: 500 })
  }
}

export async function POST(req: Request) {
  let body: { upserts?: UpsertEntry[]; deletes?: string[] } | null = null
  try {
    body = (await req.json()) as { upserts?: UpsertEntry[]; deletes?: string[] }
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 })
  }

  const upserts = Array.isArray(body?.upserts) ? body!.upserts : []
  const deletes = Array.isArray(body?.deletes) ? body!.deletes : []

  try {
    for (const item of upserts) {
      const key = sanitizeKey(item?.key)
      if (!key || !MANAGED_KEYS.has(key)) continue
      const value = String(item?.value ?? "")
      db.insert(schema.appState)
        .values({
          key,
          value,
          updatedAt: new Date().toISOString(),
        })
        .onConflictDoUpdate({
          target: schema.appState.key,
          set: {
            value,
            updatedAt: new Date().toISOString(),
          },
        })
        .run()
    }

    const cleanedDeleteKeys = deletes.map((k) => sanitizeKey(k)).filter((k) => MANAGED_KEYS.has(k))
    if (cleanedDeleteKeys.length > 0) {
      db.delete(schema.appState).where(inArray(schema.appState.key, cleanedDeleteKeys)).run()
    }

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Failed to save app state" }, { status: 500 })
  }
}
