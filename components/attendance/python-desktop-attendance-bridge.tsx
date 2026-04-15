"use client"

import { useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Alert } from "@/components/ui/alert"
import { Terminal, Download, FileUp, FolderOpen } from "lucide-react"
import { slugForPythonFilename } from "@/lib/python-attendance-filename"

type RosterStudent = { id: string; name: string; rollNumber?: string }

interface PythonDesktopAttendanceBridgeProps {
  className: string
  rosterStudents: RosterStudent[]
  onImportMarks: (
    marks: Array<{ studentId: string; name: string; confidence: number }>,
  ) => Promise<void> | void
}

function parseCsvRows(text: string): Array<{ roll: string; name: string; confidence: string }> {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  if (lines.length < 2) return []

  const header = lines[0].toLowerCase()
  const hasHeader = header.includes("roll") && header.includes("name")
  const dataLines = hasHeader ? lines.slice(1) : lines

  const rows: Array<{ roll: string; name: string; confidence: string }> = []

  for (const line of dataLines) {
    const cells: string[] = []
    let cur = ""
    let inQ = false
    for (let i = 0; i < line.length; i++) {
      const c = line[i]
      if (c === '"') {
        inQ = !inQ
        continue
      }
      if (c === "," && !inQ) {
        cells.push(cur.trim())
        cur = ""
        continue
      }
      cur += c
    }
    cells.push(cur.trim())
    if (cells.length < 2) continue
    rows.push({
      roll: cells[0] || "",
      name: cells[1] || "",
      confidence: cells.length >= 4 ? cells[3] : "0.75",
    })
  }
  return rows
}

function rosterMatch(
  roster: RosterStudent,
  csvRoll: string,
  csvName: string,
): boolean {
  const roll = csvRoll.trim()
  const namePart = csvName.trim().toLowerCase()
  if (!namePart && !roll) return false

  const rRoll = String(roster.rollNumber ?? "").trim()
  if (roll && rRoll && roll === rRoll) return true

  const full = roster.name.trim().toLowerCase()
  const slug = slugForPythonFilename(roster.name)
  if (namePart && (full === namePart || slug === namePart)) return true
  if (namePart && full.replace(/\s+/g, "_") === namePart) return true
  const first = full.split(/\s+/)[0] ?? ""
  if (namePart && (first === namePart || full.startsWith(namePart))) return true
  return false
}

export function PythonDesktopAttendanceBridge({
  className,
  rosterStudents,
  onImportMarks,
}: PythonDesktopAttendanceBridgeProps) {
  const [status, setStatus] = useState<string>("")
  const [busy, setBusy] = useState(false)

  const downloadClassImagesForPythonFolder = async () => {
    setBusy(true)
    setStatus("")
    try {
      const rosterIds = new Set(rosterStudents.map((s) => s.id))
      const res = await fetch("/api/students/dataset?includeImages=1")
      const json = (await res.json()) as {
        ok?: boolean
        data?: Array<{
          studentId: string
          studentName: string
          rollNumber?: string | null
          imageData?: string
        }>
      }
      if (!res.ok || !json.ok || !Array.isArray(json.data)) {
        setStatus("Could not load face dataset from the server.")
        return
      }

      const inClass = json.data.filter((row) => rosterIds.has(row.studentId) && row.imageData)
      if (inClass.length === 0) {
        setStatus(
          "No saved face photos for students in this class. Add them under Teacher → Student Dataset first.",
        )
        return
      }

      let n = 0
      for (const row of inClass) {
        const imageData = row.imageData
        if (!imageData) continue
        const rollRaw = String(row.rollNumber ?? row.studentId).replace(/[^\w\d-]/g, "") || "0"
        const base = `${rollRaw}_${slugForPythonFilename(row.studentName)}`
        const ext = imageData.startsWith("data:image/png") ? "png" : "jpg"
        const a = document.createElement("a")
        a.href = imageData
        a.download = `${base}.${ext}`
        a.rel = "noopener"
        document.body.appendChild(a)
        a.click()
        a.remove()
        n++
        await new Promise((r) => setTimeout(r, 120))
      }
      setStatus(`Started download of ${n} image(s). Save them into the project folder "Facial Attendance System/images" (same naming as your classmate's app: roll_name).`)
    } catch (e) {
      console.error(e)
      setStatus("Download failed. Check the console for details.")
    } finally {
      setBusy(false)
    }
  }

  const onCsvSelected = async (file: File | null) => {
    if (!file) return
    setBusy(true)
    setStatus("")
    try {
      const text = await file.text()
      const parsed = parseCsvRows(text)
      if (parsed.length === 0) {
        setStatus("No data rows found in that CSV.")
        return
      }

      const marks: Array<{ studentId: string; name: string; confidence: number }> = []
      const used = new Set<string>()

      for (const row of parsed) {
        const student = rosterStudents.find(
          (s) => rosterMatch(s, row.roll, row.name) && !used.has(s.id),
        )
        if (!student) continue
        used.add(student.id)
        const c = parseFloat(String(row.confidence).replace(/[^\d.-]/g, ""))
        marks.push({
          studentId: student.id,
          name: student.name,
          confidence: Number.isFinite(c) ? Math.min(1, Math.max(0, c)) : 0.75,
        })
      }

      if (marks.length === 0) {
        setStatus(
          "No rows matched this class roster. Use roll numbers and names consistent with your image filenames (e.g. 017_ukasha → roll 017, name ukasha).",
        )
        return
      }

      await onImportMarks(marks)
      setStatus(`Imported ${marks.length} present mark(s) from the desktop scanner CSV for ${className}.`)
    } catch (e) {
      console.error(e)
      setStatus("Could not read the CSV file.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      <Card className="p-6 border-primary/20 bg-primary/5">
        <div className="flex items-start gap-3">
          <Terminal className="w-6 h-6 text-primary shrink-0 mt-0.5" />
          <div className="space-y-2 text-sm text-foreground/80">
            <p className="font-semibold text-foreground">Classmate desktop scanner (OpenCV + face_recognition)</p>
            <p>
              The folder <code className="text-xs bg-muted px-1 rounded">Facial Attendance System</code> runs{" "}
              <code className="text-xs bg-muted px-1 rounded">program.py</code> on your computer. It cannot run inside
              the browser. While you run <code className="text-xs bg-muted px-1 rounded">next dev</code> locally, saving
              a face in <strong>Student Dataset</strong> (Teacher portal) or Admin facial setup also writes the same{" "}
              <code className="text-xs bg-muted px-1 rounded">roll_name</code> image into{" "}
              <code className="text-xs bg-muted px-1 rounded">Facial Attendance System/images</code> automatically. Use
              download below if you need copies on another machine or the folder did not update.
            </p>
          </div>
        </div>
      </Card>

      <Card className="p-6 space-y-4">
        <h4 className="font-semibold text-foreground flex items-center gap-2">
          <FolderOpen className="w-4 h-4" />
          Step 1 — Images for <span className="text-primary">{className}</span>
        </h4>
        <p className="text-sm text-foreground/70">
          Dataset saves usually mirror here automatically (local server only). If needed, download photos for this class
          and drop them into{" "}
          <code className="text-xs bg-muted px-1 rounded break-all">Facial Attendance System/images</code> as{" "}
          <code className="text-xs bg-muted px-1 rounded">roll_name.jpg</code> (e.g.{" "}
          <code className="text-xs bg-muted px-1 rounded">017_ukasha.jpg</code>).
        </p>
        <Button type="button" onClick={downloadClassImagesForPythonFolder} disabled={busy} className="gap-2">
          <Download className="w-4 h-4" />
          Download class face images
        </Button>
      </Card>

      <Card className="p-6 space-y-4">
        <h4 className="font-semibold text-foreground flex items-center gap-2">
          <Terminal className="w-4 h-4" />
          Step 2 — Run the Python attendance program
        </h4>
        <ol className="text-sm text-foreground/70 list-decimal pl-5 space-y-1">
          <li>Open a terminal in the project folder.</li>
          <li>
            Activate the venv:{" "}
            <code className="text-xs bg-muted px-1 rounded whitespace-pre-wrap">
              Facial Attendance System\attendance_system\Scripts\activate
            </code>
          </li>
          <li>
            Run:{" "}
            <code className="text-xs bg-muted px-1 rounded">cd &quot;Facial Attendance System&quot; &amp;&amp; python program.py</code>
          </li>
          <li>Press <kbd className="px-1 bg-muted rounded text-xs">q</kbd> when finished; a timestamped CSV is created next to program.py.</li>
        </ol>
      </Card>

      <Card className="p-6 space-y-4">
        <h4 className="font-semibold text-foreground flex items-center gap-2">
          <FileUp className="w-4 h-4" />
          Step 3 — Import CSV into this session
        </h4>
        <p className="text-sm text-foreground/70">
          Columns expected: Roll No, Name, Time, Confidence (as written by program.py). Rows are matched to this class
          roster by roll number or name.
        </p>
        <label className="block">
          <input
            type="file"
            accept=".csv,text/csv"
            className="text-sm text-foreground/80 file:mr-3 file:rounded-md file:border file:border-border file:bg-card file:px-3 file:py-1.5"
            disabled={busy}
            onChange={(e) => {
              const f = e.target.files?.[0] ?? null
              void onCsvSelected(f)
              e.target.value = ""
            }}
          />
        </label>
      </Card>

      {status ? (
        <Alert className="border-border bg-card">
          <p className="text-sm text-foreground">{status}</p>
        </Alert>
      ) : null}
    </div>
  )
}
