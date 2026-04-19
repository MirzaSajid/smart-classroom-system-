"use client"

import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useState, useEffect } from "react"
import { AlertCircle, TrendingUp, Users, AlertTriangle } from "lucide-react"
import { AdminDataManager } from "@/components/admin/admin-data-manager"
import { AnnouncementsManager } from "@/components/admin/announcements-manager"
import { FeeManager } from "@/components/admin/fee-manager"

interface AdminData {
  classes: any[]
  sections: any[]
  students: any[]
}

export function AdminDashboard() {
  const [adminData, setAdminData] = useState<AdminData | null>(null)
  const [activeTab, setActiveTab] = useState<"dashboard" | "settings" | "announcements" | "fees">("dashboard")
  const [attendanceStats, setAttendanceStats] = useState({ present: 0, absent: 0 })
  const [studentQuery, setStudentQuery] = useState("")

  useEffect(() => {
    const stored = localStorage.getItem('adminData')
    if (stored) {
      try {
        setAdminData(JSON.parse(stored))
      } catch (e) {
        console.error('[v0] Failed to load admin data:', e)
      }
    }
  }, [])

  // Load attendance stats in real-time
  useEffect(() => {
    const loadAttendance = () => {
      const records = localStorage.getItem('attendanceRecords')
      const today = new Date().toISOString().split('T')[0]
      
      if (records && adminData) {
        try {
          const parsed = JSON.parse(records)
          const todayRecords = parsed.filter((r: any) => r.date === today)
          const presentIds = new Set(todayRecords.map((r: any) => r.studentId))
          const presentCount = presentIds.size
          const absentCount = Math.max(0, (adminData.students?.length || 0) - presentCount)
          
          setAttendanceStats({ present: presentCount, absent: absentCount })
        } catch (e) {
          console.error('[v0] Failed to load attendance:', e)
        }
      }
    }

    loadAttendance()
    const interval = setInterval(loadAttendance, 3000)
    return () => clearInterval(interval)
  }, [adminData])

  // Dynamically load attendance data from localStorage
  const getAttendanceData = () => {
    const records = localStorage.getItem('attendanceRecords')
    if (records) {
      try {
        const parsed = JSON.parse(records)
        const dates: { [key: string]: { present: number; absent: number; late: number } } = {}
        parsed.forEach((record: any) => {
          const date = record.date || new Date().toISOString().split('T')[0]
          if (!dates[date]) dates[date] = { present: 0, absent: 0, late: 0 }
          if (record.attendance === 'present') dates[date].present++
          else if (record.attendance === 'late') dates[date].late++
          else dates[date].absent++
        })
        return Object.entries(dates).map(([date, data]) => ({
          day: date.split('-')[2],
          ...data,
        }))
      } catch (e) {
        return []
      }
    }
    return []
  }

  const attendanceData = getAttendanceData()

  if (!adminData) {
    return (
      <div className="space-y-4">
        <AdminDataManager />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-3xl font-bold text-foreground tracking-tight">Admin Dashboard</h2>
          <p className="text-foreground/60">Campus-wide monitoring and analytics</p>
        </div>
        <Badge variant="outline" className="bg-transparent">
          Students: {adminData.students?.length || 0}
        </Badge>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="space-y-4">
        <TabsList className="bg-[var(--glass-bg)] border border-[var(--glass-border)] backdrop-blur-2xl">
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="settings">Settings & Data</TabsTrigger>
          <TabsTrigger value="announcements">Announcements</TabsTrigger>
          <TabsTrigger value="fees">Fees</TabsTrigger>
        </TabsList>

        <TabsContent value="settings" className="animate-in fade-in-0">
          <Card variant="glass" className="p-4">
            <AdminDataManager />
          </Card>
        </TabsContent>

        <TabsContent value="announcements" className="animate-in fade-in-0">
          <AnnouncementsManager />
        </TabsContent>

        <TabsContent value="fees" className="animate-in fade-in-0">
          <FeeManager />
        </TabsContent>

        <TabsContent value="dashboard" className="space-y-6 animate-in fade-in-0">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card variant="glass" className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-foreground/60">Total Students</p>
                  <p className="text-2xl font-bold text-foreground">{adminData.students?.length || 0}</p>
                </div>
                <Users className="w-8 h-8 text-primary/40" />
              </div>
            </Card>
            <Card variant="glass" className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-foreground/60">Total Classes</p>
                  <p className="text-2xl font-bold text-foreground">{adminData.classes.length || 0}</p>
                </div>
                <TrendingUp className="w-8 h-8 text-primary/40" />
              </div>
            </Card>
            <Card variant="glass" className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-foreground/60">Present Today</p>
                  <p className="text-2xl font-bold text-primary">{attendanceStats.present}</p>
                </div>
                <AlertCircle className="w-8 h-8 text-primary/40" />
              </div>
            </Card>
            <Card variant="glass" className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-foreground/60">Absent Today</p>
                  <p className="text-2xl font-bold text-destructive">{attendanceStats.absent}</p>
                </div>
                <AlertTriangle className="w-8 h-8 text-destructive/40" />
              </div>
            </Card>
          </div>

          <Card variant="glass" className="p-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <p className="text-sm font-medium text-foreground">Today’s attendance</p>
                <p className="text-xs text-foreground/60">Search by name or roll number.</p>
              </div>
              <Input
                value={studentQuery}
                onChange={(e) => setStudentQuery(e.target.value)}
                placeholder="Search students…"
                className="w-72 bg-[var(--glass-bg)] border-[var(--glass-border)]"
              />
            </div>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card variant="glass" className="p-6">
              <h3 className="text-lg font-semibold text-foreground mb-4">Present Students</h3>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {adminData && (() => {
                  const q = studentQuery.trim().toLowerCase()
                  const records = localStorage.getItem('attendanceRecords')
                  const today = new Date().toISOString().split('T')[0]
                  if (!records) return <p className="text-foreground/60 text-sm">No attendance records yet</p>

                  const parsed = JSON.parse(records)
                  const todayRecords = parsed.filter((r: any) => r.date === today)
                  const presentIds = new Set(todayRecords.map((r: any) => r.studentId))
                  const presentStudents = adminData.students.filter((s: any) => presentIds.has(s.id)).filter((s: any) => {
                    if (!q) return true
                    return `${s.name || ''} ${s.rollNumber || ''}`.toLowerCase().includes(q)
                  })

                  if (presentStudents.length === 0) {
                    return <p className="text-foreground/60 text-sm">No students marked present yet</p>
                  }

                  return presentStudents.map((student: any) => (
                    <div
                      key={student.id}
                      className="flex items-center justify-between p-3 bg-primary/5 rounded-xl border border-primary/15"
                    >
                      <div className="min-w-0">
                        <p className="font-medium text-foreground truncate">{student.name}</p>
                        <p className="text-xs text-foreground/50">{student.rollNumber || 'N/A'}</p>
                      </div>
                      <span className="text-xs font-semibold text-primary">✓ Present</span>
                    </div>
                  ))
                })()}
              </div>
            </Card>

            <Card variant="glass" className="p-6">
              <h3 className="text-lg font-semibold text-foreground mb-4">Absent Students</h3>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {adminData && (() => {
                  const q = studentQuery.trim().toLowerCase()
                  const records = localStorage.getItem('attendanceRecords')
                  const today = new Date().toISOString().split('T')[0]

                  const parsed = records ? JSON.parse(records) : []
                  const todayRecords = parsed.filter((r: any) => r.date === today)
                  const presentIds = new Set(todayRecords.map((r: any) => r.studentId))
                  const absentStudents = adminData.students.filter((s: any) => !presentIds.has(s.id)).filter((s: any) => {
                    if (!q) return true
                    return `${s.name || ''} ${s.rollNumber || ''}`.toLowerCase().includes(q)
                  })

                  if (absentStudents.length === 0) {
                    return <p className="text-foreground/60 text-sm">All students present</p>
                  }

                  return absentStudents.map((student: any) => (
                    <div
                      key={student.id}
                      className="flex items-center justify-between p-3 bg-destructive/5 rounded-xl border border-destructive/15"
                    >
                      <div className="min-w-0">
                        <p className="font-medium text-foreground truncate">{student.name}</p>
                        <p className="text-xs text-foreground/50">{student.rollNumber || 'N/A'}</p>
                      </div>
                      <span className="text-xs font-semibold text-destructive">✗ Absent</span>
                    </div>
                  ))
                })()}
              </div>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
