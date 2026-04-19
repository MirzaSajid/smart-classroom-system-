"use client"

import { useEffect, useMemo, useState } from "react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ClipboardCheck, Users, BookOpen, Smile, GraduationCap, Smartphone, Megaphone } from "lucide-react"
import { BehaviorDetectionMonitor } from "@/components/behavior/behavior-detection-monitor"
import { AttendanceSession } from "@/components/attendance/attendance-session"
import { StudentDatasetManager } from "@/components/attendance/student-dataset-manager"
import { GradesManager } from "@/components/admin/grades-manager"
import type { Announcement } from "@/components/admin/announcements-manager"

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
  const [announcements, setAnnouncements] = useState<Announcement[]>([])

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

  useEffect(() => {
    const load = () => {
      try {
        const raw = localStorage.getItem("announcements")
        if (!raw) {
          setAnnouncements([])
          return
        }
        const parsed = JSON.parse(raw)
        setAnnouncements(Array.isArray(parsed) ? parsed : [])
      } catch {
        setAnnouncements([])
      }
    }
    load()
    const onStorage = () => load()
    window.addEventListener("storage", onStorage)
    return () => window.removeEventListener("storage", onStorage)
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
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-3xl font-bold text-foreground tracking-tight">Teacher Portal</h2>
          <p className="text-foreground/60">{currentTeacher ? `Welcome, ${currentTeacher}` : "Manage class operations"}</p>
        </div>
        <Badge variant="outline" className="bg-transparent">
          {selectedClass ? `Class: ${selectedClass?.name}` : "No class selected"}
        </Badge>
      </div>

      <Card variant="glass" className="p-4">
        <div className="flex items-start justify-between gap-4 flex-col lg:flex-row">
          <div className="space-y-1">
            <p className="text-sm font-medium text-foreground">Quick actions</p>
            <p className="text-xs text-foreground/60">
              Select a class once — attendance and behavior monitoring will use it.
            </p>
          </div>
          <div className="flex gap-2 w-full lg:w-auto">
            <select
              value={selectedClassId}
              onChange={(e) => {
                setSelectedClassId(e.target.value)
                setSessionStartTime(null)
              }}
              className="w-full lg:w-96 px-3 py-2 rounded-xl border border-[var(--glass-border)] bg-[var(--glass-bg)] backdrop-blur-xl text-foreground"
            >
              <option value="">Select a class...</option>
              {myClasses.map((cls: any) => (
                <option key={String(cls?.id)} value={String(cls?.id)}>
                  {cls?.name || "Untitled Class"}
                </option>
              ))}
            </select>
            <Button
              variant="outline"
              className="rounded-xl"
              onClick={() => {
                setSelectedClassId("")
                setSessionStartTime(null)
              }}
              disabled={!selectedClassId && !sessionStartTime}
            >
              Clear
            </Button>
          </div>
        </div>
      </Card>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="space-y-4">
        <TabsList className="bg-[var(--glass-bg)] border border-[var(--glass-border)] backdrop-blur-2xl">
          <TabsTrigger value="overview" className="gap-2">
            <BookOpen className="w-4 h-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="attendance" className="gap-2">
            <ClipboardCheck className="w-4 h-4" />
            Attendance
          </TabsTrigger>
          <TabsTrigger value="dataset" className="gap-2">
            <Smile className="w-4 h-4" />
            Dataset
          </TabsTrigger>
          <TabsTrigger value="grades" className="gap-2">
            <GraduationCap className="w-4 h-4" />
            Grades
          </TabsTrigger>
          <TabsTrigger value="behavior" className="gap-2">
            <Smartphone className="w-4 h-4" />
            Class behavior
          </TabsTrigger>
        </TabsList>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 space-y-6">
            {/* ATTENDANCE TAB (restored full facial attendance flow) */}
            <TabsContent value="attendance" className="space-y-6 animate-in fade-in-0">
              <div className="space-y-6">
                <Card variant="glass" className="p-6">
                  <div className="flex items-start justify-between gap-4 flex-col md:flex-row">
                    <div className="space-y-1">
                      <h3 className="text-lg font-semibold text-foreground">Start Facial Attendance Session</h3>
                      <p className="text-sm text-foreground/60">
                        Pick a class and start the live facial attendance session (saved settings are reused
                        automatically).
                      </p>
                    </div>
                    <div className="flex gap-2 w-full md:w-auto">
                      <Input
                        value={selectedClass ? String(selectedClass?.name || "") : ""}
                        readOnly
                        placeholder="Select a class above…"
                        className="w-full md:w-80 bg-[var(--glass-bg)] border-[var(--glass-border)]"
                      />
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
                  <Card variant="glass" className="p-6">
                    <p className="text-foreground/60">
                      Select a class and click <span className="font-medium text-foreground">Start</span> to open the
                      full facial attendance system.
                    </p>
                  </Card>
                )}
              </div>
            </TabsContent>

            {/* DATASET TAB (faces DB) */}
            <TabsContent value="dataset" className="animate-in fade-in-0">
              <StudentDatasetManager />
            </TabsContent>

            {/* GRADES TAB */}
            <TabsContent value="grades" className="animate-in fade-in-0">
              <GradesManager />
            </TabsContent>

            {/* CLASS BEHAVIOR — mobile / device use (Roboflow pretrained) */}
            <TabsContent value="behavior" className="space-y-4 animate-in fade-in-0">
              <Card variant="glass" className="p-4">
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
            </TabsContent>

            {/* OVERVIEW TAB */}
            <TabsContent value="overview" className="space-y-6 animate-in fade-in-0">
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Card variant="glass" className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-foreground/60">My Classes</p>
                        <p className="text-2xl font-bold text-foreground">{myClasses.length}</p>
                      </div>
                      <BookOpen className="w-8 h-8 text-primary/40" />
                    </div>
                  </Card>
                  <Card variant="glass" className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-foreground/60">Total Students</p>
                        <p className="text-2xl font-bold text-foreground">{totalStudents}</p>
                      </div>
                      <Users className="w-8 h-8 text-primary/40" />
                    </div>
                  </Card>
                  <Card variant="glass" className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-foreground/60">Attendance Records Today</p>
                        <p className="text-2xl font-bold text-primary">{todayAttendanceCount}</p>
                      </div>
                      <ClipboardCheck className="w-8 h-8 text-primary/40" />
                    </div>
                  </Card>
                </div>

                <Card variant="glass" className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-foreground">Classes</h3>
                    <Badge className="bg-primary/20 text-primary">{myClasses.length ? "Loaded" : "No classes"}</Badge>
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
                          className="flex items-center justify-between p-4 rounded-xl bg-[var(--glass-bg)] border border-[var(--glass-border)] backdrop-blur-xl"
                        >
                          <div>
                            <p className="font-medium text-foreground">{cls?.name || "Untitled Class"}</p>
                            <p className="text-sm text-foreground/60 mt-1">Teacher: {cls?.classTeacher || "Unassigned"}</p>
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
            </TabsContent>
          </div>

          <div className="lg:col-span-1">
            <Card variant="glass" className="p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <Megaphone className="w-4 h-4 text-primary" />
                  Announcements
                </p>
                <Badge variant="outline" className="bg-transparent">
                  {
                    announcements.filter((a) => a.audience === "all" || a.audience === "teachers").length
                  }
                </Badge>
              </div>
              <div className="mt-3 space-y-2 max-h-[420px] overflow-y-auto pr-1">
                {announcements
                  .filter((a) => a.audience === "all" || a.audience === "teachers")
                  .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
                  .slice(0, 20)
                  .map((a) => (
                    <div
                      key={a.id}
                      className="rounded-xl border border-[var(--glass-border)] bg-[var(--glass-bg)] p-3 hover:bg-[var(--glass-bg-strong)] transition-colors"
                    >
                      <p className="text-sm font-semibold text-foreground">{a.title}</p>
                      <p className="text-xs text-foreground/70 mt-1 whitespace-pre-wrap">{a.message}</p>
                      <p className="text-[10px] text-foreground/50 mt-2">
                        {new Date(a.createdAt).toLocaleString()}
                      </p>
                    </div>
                  ))}
                {announcements.filter((a) => a.audience === "all" || a.audience === "teachers").length === 0 ? (
                  <p className="text-sm text-foreground/60">No announcements yet.</p>
                ) : null}
              </div>
            </Card>
          </div>
        </div>
      </Tabs>
    </div>
  )
}
