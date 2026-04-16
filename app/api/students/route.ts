import { NextResponse } from "next/server"

import { db, schema } from "@/lib/db"

export async function GET() {
  try {
    const students = db
      .select({
        id: schema.students.id,
        name: schema.students.name,
        rollNumber: schema.students.rollNumber,
        email: schema.students.email,
        parentContact: schema.students.parentContact,
      })
      .from(schema.students)
      .all()

    return NextResponse.json({ ok: true, data: students })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Failed to load students" }, { status: 500 })
  }
}
