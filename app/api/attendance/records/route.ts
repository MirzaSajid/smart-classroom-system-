import { NextResponse } from "next/server"
import { and, eq, gte, lte } from "drizzle-orm"

import { db, schema } from "@/lib/db"

export const runtime = "nodejs"

function isoDateOnly(d: Date) {
  return d.toISOString().split("T")[0]
}

export async function GET(req: Request) {
  const url = new URL(req.url)
  const studentId = (url.searchParams.get("studentId") || "").trim()
  const classId = (url.searchParams.get("classId") || "").trim()
  const date = (url.searchParams.get("date") || "").trim()
  const from = (url.searchParams.get("from") || "").trim()
  const to = (url.searchParams.get("to") || "").trim()

  if (!studentId && !classId) {
    return NextResponse.json(
      { ok: false, error: "Provide at least studentId or classId" },
      { status: 400 },
    )
  }

  try {
    const whereParts: any[] = []
    if (studentId) whereParts.push(eq(schema.attendanceRecords.studentId, studentId))
    if (classId) whereParts.push(eq(schema.attendanceRecords.classId, classId))
    if (date) whereParts.push(eq(schema.attendanceRecords.date, date))

    // Optional range filter (YYYY-MM-DD)
    if (!date && (from || to)) {
      const fromDate = from || isoDateOnly(new Date(0))
      const toDate = to || isoDateOnly(new Date())
      whereParts.push(gte(schema.attendanceRecords.date, fromDate))
      whereParts.push(lte(schema.attendanceRecords.date, toDate))
    }

    const rows = db
      .select()
      .from(schema.attendanceRecords)
      .where(whereParts.length === 1 ? whereParts[0] : and(...whereParts))
      .all()

    return NextResponse.json({ ok: true, data: rows })
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? "Failed to fetch attendance records" },
      { status: 500 },
    )
  }
}

