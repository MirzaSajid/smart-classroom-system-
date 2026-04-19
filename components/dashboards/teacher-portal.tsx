"use client"

import { useEffect, useMemo, useState } from "react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ClipboardCheck, Users, BookOpen, Smile, GraduationCap, Smartphone } from "lucide-react"
import { BehaviorDetectionMonitor } from "@/components/behavior/behavior-detection-monitor"
import { AttendanceSession } from "@/components/attendance/attendance-session"
import { StudentDatasetManager } from "@/components/attendance/student-dataset-manager"
import { GradesManager } from "@/components/admin/grades-manager"

type AdminData = {
  classes?: any[]
  students?: any[]
}

export function TeacherPortal() {
  const [adminData, setAdminData] = useState<AdminData | null>(null)
  const [currentTeacherId, setCurrentTeacherId] = useState<string>("")
  const [currentTeacher, setCurrentTeacher] = useState<string>("")
  const [activeTab, setActiveTab] = useState<"overview" | "attendance" | "dataset" | "grades" | "behavior">("attendance")
  const [selectedClassId, setSelectedClassId] = useState<string>("")
  const [sessionStartTime, setSessionStartTime] = useState<Date | null>(null)

  useEffect(() => {
    const stored = localStorage.getItem("adminData")
    if (stored) {
      try {
        setAdminData(JSON.parse(stored))
      } catch (e) {
        console.error("[v0] Failed to load admin data:", e)
      }
    }

    const user = localStorage.getItem("currentUser")
    if (user) {
      try {
        const parsed = JSON.parse(user)
        setCurrentTeacherId(parsed?.teacherId || "")
        setCurrentTeacher(parsed?.name || parsed?.username || "")
      } catch (e) {
        console.error("[v0] Failed to load current user:", e)
      }
    }
  }, [])

  const myClasses = useMemo(() => {
    const classes = adminData?.classes || []
    if (!currentTeacherId && !currentTeacher) return classes
    return classes.filter((cls: any) => {
      const assigned = String(cls?.classTeacher || "")
      return assigned === String(currentTeacherId) || assigned === String(currentTeacher)
    })
  }, [adminData, currentTeacherId, currentTeacher])

  const selectedClass = useMemo(() => {
    return myClasses.find((c: any) => String(c?.id) === String(selectedClassId)) || null
  }, [myClasses, selectedClassId])

  const totalStudents = useMemo(() => {
    const students = adminData?.students || []
    if (!myClasses.length) return 0
    const classIds = new Set(myClasses.map((c: any) => c?.id).filter(Boolean))
    return students.filter((s: any) => {
      const ids = Array.isArray(s?.classIds) ? s.classIds : s?.classId ? [s.classId] : []
      return ids.some((id: any) => classIds.has(id))
    }).length
  }, [adminData, myClasses])

  const todayAttendanceCount = useMemo(() => {
    const records = localStorage.getItem("attendanceRecords")
    if (!records) return 0
    try {
      const parsed = JSON.parse(records)
      const today = new Date().toISOString().split("T")[0]
      return parsed.filter((r: any) => r?.date === today).length
    } catch {
      return 0
    }
  }, [])

  return (
    <div className="p-8 space-y-8">
      <div>
        <h2 className="text-3xl font-bold text-foreground mb-2">Teacher Portal</h2>
        <p className="text-foreground/60">
          {currentTeacher ? `Welcome, ${currentTeacher}` : "Manage classes, attendance, and grades"}
        </p>
      </div>

      {/* Teacher Tabs */}
      <div className="flex gap-2 border-b border-border overflow-x-auto">
        <Button
          variant={activeTab === "attendance" ? "default" : "ghost"}
          onClick={() => setActiveTab("attendance")}
          className="gap-2"
        >
          <ClipboardCheck className="w-4 h-4" />
          Facial Attendance
        </Button>
        <Button
          variant={activeTab === "dataset" ? "default" : "ghost"}
          onClick={() => setActiveTab("dataset")}
          className="gap-2"
        >
          <Smile className="w-4 h-4" />
          Student Dataset
        </Button>
        <Button
          variant={activeTab === "grades" ? "default" : "ghost"}
          onClick={() => setActiveTab("grades")}
          className="gap-2"
        >
          <GraduationCap className="w-4 h-4" />
          Grades
        </Button>
        <Button
          variant={activeTab === "overview" ? "default" : "ghost"}
          onClick={() => setActiveTab("overview")}
          className="gap-2"
        >
          <BookOpen className="w-4 h-4" />
          Overview
        </Button>
        <Button
          variant={activeTab === "behavior" ? "default" : "ghost"}
          onClick={() => setActiveTab("behavior")}
          className="gap-2"
        >
          <Smartphone className="w-4 h-4" />
          Class behavior
        </Button>
      </div>

      {/* ATTENDANCE TAB (restored full facial attendance flow) */}
      {activeTab === "attendance" && (
        <div className="space-y-6">
          <Card className="p-6">
            <div className="flex items-start justify-between gap-4 flex-col md:flex-row">
              <div className="space-y-1">
                <h3 className="text-lg font-semibold text-foreground">Start Facial Attendance Session</h3>
                <p className="text-sm text-foreground/60">
                  Pick a class and start the live facial attendance session (saved settings are reused automatically).
                </p>
              </div>
              <div className="flex gap-2 w-full md:w-auto">
                <select
                  value={selectedClassId}
                  onChange={(e) => {
                    setSelectedClassId(e.target.value)
                    setSessionStartTime(null)
                  }}
                  className="w-full md:w-80 px-3 py-2 border border-border rounded-md bg-background text-foreground"
                >
                  <option value="">Select a class...</option>
                  {myClasses.map((cls: any) => (
                    <option key={String(cls?.id)} value={String(cls?.id)}>
                      {cls?.name || "Untitled Class"}
                    </option>
                  ))}
                </select>
                <Button
                  onClick={() => {
                    if (!selectedClassId) return
                    setSessionStartTime(new Date())
                  }}
                  disabled={!selectedClassId}
                  className="whitespace-nowrap"
                >
                  Start
                </Button>
              </div>
            </div>
          </Card>
        {sessionStartTime && selectedClass ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3 flex-col sm:flex-row">
                <div className="text-sm text-foreground/60">
                  Session running for <span className="font-medium text-foreground">{selectedClass?.name}</span>
                </div>
                <Button variant="outline" onClick={() => setSessionStartTime(null)}>
                  Back to class selection
                </Button>
              </div>
              <AttendanceSession
                classId={String(selectedClass.id)}
                className={String(selectedClass.name || "Untitled Class")}
                startTime={sessionStartTime}
              />
            </div>
          ) : (
            <Card className="p-6">
              <p className="text-foreground/60">
                Select a class and click <span className="font-medium text-foreground">Start</span> to open the full
                facial attendance system.
              </p>
            </Card>
          )}
        </div>
      )}

      {/* DATASET TAB (faces DB) */}
      {activeTab === "dataset" && (
        <StudentDatasetManager />
      )}

      {/* GRADES TAB */}
      {activeTab === "grades" && (
        <GradesManager />
      )}

      {/* CLASS BEHAVIOR — mobile / device use (Roboflow pretrained) */}
      {activeTab === "behavior" && (
        <div className="space-y-4">
          <Card className="p-4">
            <p className="text-sm text-foreground/80">
              Live check for <span className="font-medium text-foreground">phones and mobile devices</span> during
              class. Connect a Roboflow-hosted model (Universe phone/cell detection or your own YOLO export from{" "}
              <span className="font-medium">Kaggle</span> uploaded to Roboflow). Set{" "}
              <code className="text-xs bg-muted px-1 rounded">ROBOFLOW_*</code> env vars on the server.
            </p>
          </Card>
          <BehaviorDetectionMonitor
            cameraId={selectedClassId ? `classroom-${selectedClassId}` : "teacher-class-cam"}
            sceneTitle="In-class device monitoring"
            alertLocationLabel="Classroom"
            modelHint="Recommended: a model that detects cell phones / handheld devices. Raw labels are normalized in lib/behavior-class-map.ts (e.g. COCO “cell phone” → phone_use)."
          />
        </div>
      )}

      {/* OVERVIEW TAB */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-foreground/60">My Classes</p>
                  <p className="text-2xl font-bold text-foreground">{myClasses.length}</p>
                </div>
                <BookOpen className="w-8 h-8 text-primary/40" />
              </div>
            </Card>
            <Card className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-foreground/60">Total Students</p>
                  <p className="text-2xl font-bold text-foreground">{totalStudents}</p>
                </div>
                <Users className="w-8 h-8 text-primary/40" />
              </div>
            </Card>
            <Card className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-foreground/60">Attendance Records Today</p>
                  <p className="text-2xl font-bold text-primary">{todayAttendanceCount}</p>
                </div>
                <ClipboardCheck className="w-8 h-8 text-primary/40" />
              </div>
            </Card>
          </div>

          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-foreground">Classes</h3>
              <Badge className="bg-primary/20 text-primary">
                {myClasses.length ? "Loaded" : "No classes"}
              </Badge>
            </div>
            {myClasses.length === 0 ? (
              <p className="text-foreground/60">
                No class data found yet. Ask an admin to add classes in the Admin Dashboard (Settings & Data).
              </p>
            ) : (
              <div className="space-y-3">
                {myClasses.map((cls: any) => (
                  <div
                    key={cls?.id || cls?.name}
                    className="flex items-center justify-between p-4 rounded-lg bg-card/50 border border-border"
                  >
                    <div>
                      <p className="font-medium text-foreground">{cls?.name || "Untitled Class"}</p>
                      <p className="text-sm text-foreground/60 mt-1">
                        Teacher: {cls?.classTeacher || "Unassigned"}
                      </p>
                    </div>
                    <div className="text-right">
                      <Badge className="bg-accent/20 text-accent">Active</Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  )
}
