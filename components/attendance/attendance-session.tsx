"use client"

import { useState, useEffect, useMemo } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Slider } from "@/components/ui/slider"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { FaceRecognitionCamera } from "./face-recognition-camera"
import { AttendanceMarking } from "./attendance-marking"
import { TimerDisplay } from "./timer-display"
import { CheckCircle, Settings, Video } from "lucide-react"
import {
  DEFAULT_ATTENDANCE_SETTINGS,
  loadAttendanceSettings,
  saveAttendanceSettings,
  type AttendanceSettings,
} from "@/lib/attendance-settings"

interface AttendanceSessionProps {
  classId: string
  className: string
  startTime: Date
}

interface MarkedStudent {
  id: string
  name: string
  markedAt: Date
  confidence: number
  method: "face_recognition" | "manual"
}

interface Student {
  id: string
  name: string
  rollNumber?: string
  status: "present" | "absent" | "late" | "unmarked"
}

export function AttendanceSession({ classId, className, startTime }: AttendanceSessionProps) {
  const [markedStudents, setMarkedStudents] = useState<MarkedStudent[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const rosterStudentIds = useMemo(() => [...students].map((s) => s.id).sort().join("\0"), [students])
  const enrolledIdsForCamera = useMemo(() => students.map((s) => s.id), [rosterStudentIds])
  const [sessionActive, setSessionActive] = useState(true)
  const [timeRemaining, setTimeRemaining] = useState(10 * 60) // 10 minutes in seconds
  const [activeTab, setActiveTab] = useState<"live" | "roster">("live")
  const [isSaving, setIsSaving] = useState(false)
  const [sessionSaved, setSessionSaved] = useState(false)
  const [pythonStatus, setPythonStatus] = useState<"idle" | "starting" | "running" | "error">("idle")
  const [pythonError, setPythonError] = useState<string>("")
  const [settings, setSettings] = useState<AttendanceSettings>(DEFAULT_ATTENDANCE_SETTINGS)

  useEffect(() => {
    setSettings(loadAttendanceSettings())
    const onStorage = (e: StorageEvent) => {
      if (e.key === "attendanceSettings") setSettings(loadAttendanceSettings())
    }
    window.addEventListener("storage", onStorage)
    return () => window.removeEventListener("storage", onStorage)
  }, [])

  // Start/stop the Python attendance program when session opens/closes.
  useEffect(() => {
    let cancelled = false

    const start = async () => {
      setPythonStatus("starting")
      setPythonError("")
      try {
        const res = await fetch("/api/attendance/python", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ action: "start", classId, className }),
        })
        const data = await res.json().catch(() => ({}))
        if (cancelled) return
        if (!res.ok || !data?.ok) {
          setPythonStatus("error")
          setPythonError(String(data?.error || "Failed to start python attendance"))
          return
        }
        const s = data?.state?.status
        setPythonStatus(s === "running" ? "running" : s === "starting" ? "starting" : "idle")
      } catch (e: any) {
        if (cancelled) return
        setPythonStatus("error")
        setPythonError(e?.message ?? "Failed to start python attendance")
      }
    }

    start()

    return () => {
      cancelled = true
      fetch("/api/attendance/python", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "stop" }),
      }).catch(() => {})
    }
  }, [classId, className])

  // Load real students from admin data
  useEffect(() => {
    const stored = localStorage.getItem('adminData')
    if (stored) {
      try {
        const adminData = JSON.parse(stored)
        const classes = adminData.classes || []
        const allStudents = adminData.students || []
        
        // Verify class exists
        const classExists = classes.some((c: any) => c.id === classId)
        if (!classExists) {
          console.log('[v0] Class not found, loading empty roster:', classId)
          setStudents([])
          return
        }
        
        // Filter students for this class only
        const classStudents: Student[] = allStudents
          .filter((s: any) => {
            // Support both old classId and new classIds array formats
            const classIds = s.classIds || (s.classId ? [s.classId] : [])
            return classIds.includes(classId)
          })
          .map((s: any): Student => ({
            id: String(s.id),
            name: String(s.name ?? ""),
            rollNumber: s.rollNumber != null && String(s.rollNumber).trim() !== "" ? String(s.rollNumber).trim() : undefined,
            status: "unmarked",
          }))
          .filter((s: Student) => s.id.length > 0 && s.name.length > 0)
        
        // Remove any duplicates by ID
        const uniqueStudents: Student[] = Array.from(
          new Map<string, Student>(classStudents.map((s) => [s.id, s] as const)).values(),
        )
        
        setStudents(uniqueStudents)
        console.log('[v0] Loaded', uniqueStudents.length, 'unique students for class:', className, '(ID:', classId, ')')
      } catch (e) {
        console.error('[v0] Failed to load students:', e)
        setStudents([])
      }
    } else {
      setStudents([])
    }
  }, [classId, className])

  useEffect(() => {
    if (!sessionActive || timeRemaining <= 0) return

    const timer = setInterval(() => {
      setTimeRemaining((prev) => {
        const newTime = prev - 1
        if (newTime <= 0) {
          setSessionActive(false)
          return 0
        }
        return newTime
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [sessionActive, timeRemaining])

  useEffect(() => {
    if (timeRemaining === 0 && sessionActive === false && !isSaving && !sessionSaved) {
      autoEndSession()
    }
  }, [timeRemaining, sessionActive, isSaving, sessionSaved])

  const handleAttendanceMarked = (student: { id: string; name: string; confidence: number; timestamp: Date }) => {
    setMarkedStudents((prev) => {
      const exists = prev.find((s) => s.id === student.id)
      if (exists) return prev

      return [
        ...prev,
        {
          id: student.id,
          name: student.name,
          markedAt: student.timestamp,
          confidence: student.confidence,
          method: "face_recognition",
        },
      ]
    })

    setStudents((prev) => prev.map((s) => (s.id === student.id ? { ...s, status: "present" as const } : s)))
  }

  const handleManualStatusChange = async (studentId: string, status: "present" | "absent" | "late") => {
    console.log(`[v0] Manually marking student ${studentId} as ${status}`)
    
    // Update student status in state
    const updatedStudents = students.map((s) => (s.id === studentId ? { ...s, status } : s))
    setStudents(updatedStudents)

    // Update markedStudents if present
    const existingStudent = markedStudents.find((s) => s.id === studentId)
    if (!existingStudent && status === "present") {
      const student = students.find((s) => s.id === studentId)
      if (student) {
        const newMarkedStudents: MarkedStudent[] = [
          ...markedStudents,
          {
            id: studentId,
            name: student.name,
            markedAt: new Date(),
            confidence: 0.95,
            method: "manual" satisfies MarkedStudent["method"],
          },
        ]
        setMarkedStudents(newMarkedStudents)
      }
    }
    
    // Immediately save attendance record to DB (source of truth)
    try {
      const today = new Date().toISOString().split('T')[0]
      await fetch("/api/attendance/mark", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          studentId,
          classId,
          date: today,
          status,
          method: "manual",
          markedAt: new Date().toISOString(),
          confidence: status === "present" ? 0.95 : 0,
        }),
      })
      console.log(`[v0] Saved manual attendance for student ${studentId} to database`)
    } catch (e) {
      console.error('[v0] Failed to save attendance immediately:', e)
    }
  }

  const autoEndSession = async () => {
    setIsSaving(true)
    try {
      // Save to localStorage first
      const savedLocally = saveAttendanceToLocalStorage()
      
      // Then send to API for logging
      const response = await fetch("/api/attendance/save-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          classId,
          className,
          startTime,
          endTime: new Date(),
          markedStudents,
          allStudents: students,
          autoSubmitted: true,
        }),
      })

      if (response.ok || savedLocally) {
        setSessionSaved(true)
      }
    } catch (error) {
      console.error("Failed to auto-save attendance session:", error)
    } finally {
      setIsSaving(false)
    }
  }

  const saveAttendanceToLocalStorage = () => {
    try {
      const today = new Date().toISOString().split('T')[0]
      
      // Get present students
      const presentStudents = students.filter(s => s.status === 'present')
      const absentStudents = students.filter(s => s.status === 'absent')
      const lateStudents = students.filter(s => s.status === 'late')
      
      const markedById = new Map(markedStudents.map((m) => [m.id, m]))
      const formatTime = (d: Date) => d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

      // Create attendance records
      const attendanceRecords = [
        ...presentStudents.map((s) => {
          const marked = markedById.get(s.id)
          const markedAt = marked?.markedAt ?? new Date()
          const confidence = marked?.confidence ?? 0
          const method = marked?.method ?? "manual"
          return {
            studentId: s.id,
            studentName: s.name,
            classId: classId,
            date: today,
            status: 'present',
            method,
            markedAt: markedAt.toISOString(),
            timestamp: markedAt.toISOString(),
            time: formatTime(markedAt),
            confidence,
          }
        }),
        ...absentStudents.map(s => ({
          studentId: s.id,
          studentName: s.name,
          classId: classId,
          date: today,
          status: 'absent',
          method: 'manual',
          markedAt: new Date().toISOString(),
          timestamp: new Date().toISOString(),
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          confidence: 0,
        })),
        ...lateStudents.map(s => ({
          studentId: s.id,
          studentName: s.name,
          classId: classId,
          date: today,
          status: 'late',
          method: 'manual',
          markedAt: new Date().toISOString(),
          timestamp: new Date().toISOString(),
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          confidence: 0,
        })),
      ]
      
      // Get existing records
      const existingRecords = JSON.parse(localStorage.getItem('attendanceRecords') || '[]')
      
      // Remove duplicate records for today from same class
      const filteredRecords = existingRecords.filter((r: any) => 
        !(r.date === today && r.classId === classId)
      )
      
      // Add new records
      const updatedRecords = [...filteredRecords, ...attendanceRecords]
      localStorage.setItem('attendanceRecords', JSON.stringify(updatedRecords))
      
      console.log('[v0] Saved', attendanceRecords.length, 'attendance records to localStorage')
      return true
    } catch (e) {
      console.error('[v0] Failed to save attendance to localStorage:', e)
      return false
    }
  }

  const endSession = async () => {
    setIsSaving(true)
    try {
      // Save to localStorage first
      const savedLocally = saveAttendanceToLocalStorage()
      
      // Then send to API for logging
      const response = await fetch("/api/attendance/save-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          classId,
          className,
          startTime,
          endTime: new Date(),
          markedStudents,
          allStudents: students,
          autoSubmitted: false,
        }),
      })

      if (response.ok || savedLocally) {
        setSessionActive(false)
        setSessionSaved(true)
        // Stop python process once session ends.
        fetch("/api/attendance/python", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ action: "stop" }),
        }).catch(() => {})
      }
    } catch (error) {
      console.error("Failed to save attendance session:", error)
    } finally {
      setIsSaving(false)
    }
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, "0")}`
  }

  return (
    <div className="space-y-6">
      {/* Session Header */}
      <Card className="p-6 bg-gradient-to-r from-primary/10 to-primary/5 border-primary/20">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-xl font-bold text-foreground">{className}</h3>
            <p className="text-sm text-foreground/60 mt-1">
              Started at {startTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </p>
            <p className="text-xs text-foreground/60 mt-1">
              Python attendance:{" "}
              <span
                className={
                  pythonStatus === "running"
                    ? "text-primary font-medium"
                    : pythonStatus === "starting"
                      ? "text-foreground font-medium"
                      : pythonStatus === "error"
                        ? "text-destructive font-medium"
                        : "text-foreground/60"
                }
              >
                {pythonStatus}
              </span>
              {pythonStatus === "error" && pythonError ? (
                <span className="text-destructive/80"> — {pythonError}</span>
              ) : null}
            </p>
          </div>
          <div className="text-right space-y-2">
            <div className={`text-lg font-mono font-bold ${timeRemaining < 60 ? "text-destructive" : "text-primary"}`}>
              {formatTime(timeRemaining)}
            </div>
            <p className="text-xs text-foreground/60">Time Remaining</p>
            <div className="flex justify-end">
              <Dialog>
                <DialogTrigger asChild>
                  <Button type="button" variant="outline" size="sm" className="gap-2 bg-transparent">
                    <Settings className="w-4 h-4" />
                    Settings
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Attendance Settings</DialogTitle>
                    <DialogDescription>
                      These are saved on this device and reused for every attendance session.
                    </DialogDescription>
                  </DialogHeader>

                  <div className="space-y-5">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="text-sm font-medium text-foreground">Match threshold</div>
                        <div className="text-sm text-foreground/70">{Math.round(settings.confidenceThreshold * 100)}%</div>
                      </div>
                      <Slider
                        value={[Math.round(settings.confidenceThreshold * 100)]}
                        min={40}
                        max={95}
                        step={1}
                        onValueChange={(v) =>
                          setSettings((p) => ({ ...p, confidenceThreshold: (v?.[0] ?? 70) / 100 }))
                        }
                      />
                      <p className="text-xs text-foreground/60">
                        Higher = fewer false matches, but may miss some students.
                      </p>
                    </div>

                    <div className="space-y-2">
                      <div className="text-sm font-medium text-foreground">Auto-mark window (minutes)</div>
                      <Input
                        type="number"
                        min={1}
                        max={60}
                        value={settings.autoMarkAfterMinutes}
                        onChange={(e) =>
                          setSettings((p) => ({
                            ...p,
                            autoMarkAfterMinutes: Math.max(1, Math.min(60, Number(e.target.value || 10))),
                          }))
                        }
                      />
                    </div>

                    <div className="space-y-2">
                      <div className="text-sm font-medium text-foreground">Scan interval (ms)</div>
                      <Input
                        type="number"
                        min={500}
                        max={10000}
                        value={settings.detectionIntervalMs}
                        onChange={(e) =>
                          setSettings((p) => ({
                            ...p,
                            detectionIntervalMs: Math.max(500, Math.min(10000, Number(e.target.value || 1800))),
                          }))
                        }
                      />
                      <p className="text-xs text-foreground/60">Lower is faster but uses more CPU.</p>
                    </div>
                  </div>

                  <DialogFooter>
                    <Button
                      type="button"
                      onClick={() => {
                        saveAttendanceSettings(settings)
                        // Broadcast for same-tab listeners (storage doesn't fire in same tab).
                        window.dispatchEvent(new StorageEvent("storage", { key: "attendanceSettings" }))
                      }}
                    >
                      Save settings
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            onClick={() => setActiveTab("live")}
            variant={activeTab === "live" ? "default" : "outline"}
            size="sm"
            className="gap-2"
          >
            <Video className="w-4 h-4" />
            Live facial attendance
          </Button>
          <Button onClick={() => setActiveTab("roster")} variant={activeTab === "roster" ? "default" : "outline"} size="sm" className="gap-2">
            <CheckCircle className="w-4 h-4" />
            Student roster
          </Button>
        </div>
      </Card>

      <TimerDisplay
        timeRemaining={timeRemaining}
        isExpired={!sessionActive}
        onTimeExpired={() => {
          console.log("[v0] Attendance window expired - auto-saving session")
        }}
      />

      {/* Tab Content */}
      {activeTab === "live" && (
        <>
          {typeof window !== "undefined" &&
            localStorage.setItem("currentClass", JSON.stringify({ id: classId, name: className }))}
          <FaceRecognitionCamera
            isActive={sessionActive}
            classStartTime={startTime}
            onAttendanceMarked={handleAttendanceMarked}
            autoMarkAfterMinutes={settings.autoMarkAfterMinutes}
            confidenceThreshold={settings.confidenceThreshold}
            detectionIntervalMs={settings.detectionIntervalMs}
            classId={classId}
            enrolledStudentIds={enrolledIdsForCamera}
            showEmbeddedTimer={false}
          />
        </>
      )}

      {activeTab === "roster" && (
        <AttendanceMarking
          students={students}
          onStatusChange={handleManualStatusChange}
          sessionActive={sessionActive}
          timeRemaining={timeRemaining}
        />
      )}

      {/* Summary Card */}
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <CheckCircle className="w-5 h-5 text-primary" />
          <h4 className="font-semibold text-foreground">Session Summary</h4>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
          <div>
            <p className="text-2xl font-bold text-primary">{students.filter((s) => s.status === "present").length}</p>
            <p className="text-xs text-foreground/60">Present</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-destructive">
              {students.filter((s) => s.status === "absent").length}
            </p>
            <p className="text-xs text-foreground/60">Absent</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-accent">{students.filter((s) => s.status === "late").length}</p>
            <p className="text-xs text-foreground/60">Late</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-foreground/50">
              {students.filter((s) => s.status === "unmarked").length}
            </p>
            <p className="text-xs text-foreground/60">Unmarked</p>
          </div>
        </div>

        {markedStudents.length > 0 && (
          <div className="border-t border-border pt-4 space-y-2 max-h-48 overflow-y-auto">
            {markedStudents.map((student) => (
              <div
                key={student.id}
                className="flex items-center justify-between p-2 rounded-lg bg-primary/5 border border-primary/10 text-sm"
              >
                <div>
                  <p className="font-medium text-foreground">{student.name}</p>
                  <p className="text-xs text-foreground/50">{student.id}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-foreground/60">
                    {student.markedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </p>
                  <p className="text-xs text-primary">
                    {student.method === "face_recognition"
                      ? `${Math.round(student.confidence * 100)}% match`
                      : "Manual"}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Session Status Message */}
      {sessionSaved && (
        <Card className="p-4 bg-primary/5 border border-primary/20">
          <p className="text-sm text-primary font-medium">
            Attendance session saved successfully. {markedStudents.length} students marked.
          </p>
        </Card>
      )}

      {/* End Session Button */}
      <Button onClick={endSession} disabled={!sessionActive || isSaving} size="lg" className="w-full">
        {isSaving ? "Saving..." : sessionActive ? "End Attendance Session" : "Session Ended"}
      </Button>
    </div>
  )
}
