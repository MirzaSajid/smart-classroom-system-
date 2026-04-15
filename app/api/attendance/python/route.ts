import { NextResponse } from "next/server"
import { getPythonAttendanceState, startPythonAttendance, stopPythonAttendance } from "@/lib/python-attendance"

export const runtime = "nodejs"

export async function GET() {
  return NextResponse.json({ ok: true, state: getPythonAttendanceState() })
}

export async function POST(req: Request) {
  let body: any
  try {
    body = await req.json()
  } catch {
    body = {}
  }

  const action = body?.action === "stop" ? "stop" : "start"
  const classId = typeof body?.classId === "string" ? body.classId : undefined
  const className = typeof body?.className === "string" ? body.className : undefined

  try {
    const state =
      action === "stop" ? await stopPythonAttendance() : await startPythonAttendance({ classId, className })
    return NextResponse.json({ ok: true, state })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Failed to control python attendance" }, { status: 500 })
  }
}

