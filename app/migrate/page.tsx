"use client"

import { useState } from "react"

import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

export default function MigratePage() {
  const [status, setStatus] = useState<"idle" | "running" | "done" | "error">("idle")
  const [message, setMessage] = useState<string>("")

  const runMigration = async () => {
    setStatus("running")
    setMessage("")

    try {
      const payload = {
        adminData: JSON.parse(localStorage.getItem("adminData") || "null"),
        camerasData: JSON.parse(localStorage.getItem("camerasData") || "null"),
        attendanceRecords: JSON.parse(localStorage.getItem("attendanceRecords") || "null"),
        studentDataset: JSON.parse(localStorage.getItem("studentDataset") || "null"),
      }

      const res = await fetch("/api/db/import-localstorage", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      })

      const json = (await res.json()) as { ok: boolean; error?: string }
      if (!res.ok || !json.ok) throw new Error(json.error || "Import failed")

      setStatus("done")
      setMessage("Imported localStorage data into SQLite successfully.")
    } catch (e: any) {
      setStatus("error")
      setMessage(e?.message ?? "Migration failed")
    }
  }

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-4">
      <h1 className="text-2xl font-semibold">One-time Migration</h1>
      <Card className="p-6 space-y-3">
        <p className="text-sm text-foreground/70">
          This will read data from your browser <code>localStorage</code> (admin/classes/students, cameras, attendance,
          dataset) and import it into the local SQLite database.
        </p>
        <Button onClick={runMigration} disabled={status === "running"}>
          {status === "running" ? "Migrating..." : "Migrate localStorage → SQLite"}
        </Button>
        {message && (
          <p className={`text-sm ${status === "error" ? "text-red-600" : "text-green-700"}`}>{message}</p>
        )}
      </Card>
    </div>
  )
}

