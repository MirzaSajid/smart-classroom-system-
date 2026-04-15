"use client"

import { Card } from "@/components/ui/card"
import { useState, useEffect } from "react"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts"
import { AlertCircle, TrendingUp, Users, AlertTriangle, MapPin } from "lucide-react"
import { AdminDataManager } from "@/components/admin/admin-data-manager"

interface AdminData {
  classes: any[]
  sections: any[]
  students: any[]
}

export function AdminDashboard() {
  const [adminData, setAdminData] = useState<AdminData | null>(null)
  const [activeTab, setActiveTab] = useState<"dashboard" | "settings">("dashboard")
  const [attendanceStats, setAttendanceStats] = useState({ present: 0, absent: 0 })

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

  const alertsData = [
    { name: "Security Issues", value: 0, color: "oklch(0.58 0.25 27)" },
    { name: "Attendance Anomalies", value: 0, color: "oklch(0.5 0.18 263)" },
    { name: "Behavioral Alerts", value: 0, color: "oklch(0.35 0.15 263)" },
    { name: "Resolved", value: 0, color: "oklch(0.7 0.08 263)" },
  ]

  const recentAlerts: any[] = []

  if (!adminData) {
    return (
      <div className="p-8">
        <AdminDataManager />
      </div>
    )
  }

  return (
    <div className="p-8 space-y-8">
      <div>
        <h2 className="text-3xl font-bold text-foreground mb-2">Admin Dashboard</h2>
        <p className="text-foreground/60">Campus-wide monitoring and analytics</p>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-2 border-b border-border">
        <button
          onClick={() => setActiveTab("dashboard")}
          className={`px-4 py-2 font-medium border-b-2 transition-colors ${
            activeTab === "dashboard"
              ? "border-primary text-primary"
              : "border-transparent text-foreground/60 hover:text-foreground"
          }`}
        >
          Dashboard
        </button>
        <button
          onClick={() => setActiveTab("settings")}
          className={`px-4 py-2 font-medium border-b-2 transition-colors ${
            activeTab === "settings"
              ? "border-primary text-primary"
              : "border-transparent text-foreground/60 hover:text-foreground"
          }`}
        >
          Settings & Data
        </button>
      </div>

      {activeTab === "settings" && (
        <AdminDataManager />
      )}

      {activeTab === "dashboard" && (
        <>
          {/* Key Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-foreground/60">Total Students</p>
                  <p className="text-2xl font-bold text-foreground">{adminData.students?.length || 0}</p>
                </div>
                <Users className="w-8 h-8 text-primary/40" />
              </div>
            </Card>
            <Card className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-foreground/60">Total Classes</p>
                  <p className="text-2xl font-bold text-foreground">{adminData.classes.length || 0}</p>
                </div>
                <TrendingUp className="w-8 h-8 text-primary/40" />
              </div>
            </Card>
            <Card className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-foreground/60">Present Today</p>
                  <p className="text-2xl font-bold text-primary">{attendanceStats.present}</p>
                </div>
                <AlertCircle className="w-8 h-8 text-primary/40" />
              </div>
            </Card>
            <Card className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-foreground/60">Absent Today</p>
                  <p className="text-2xl font-bold text-destructive">{attendanceStats.absent}</p>
                </div>
                <AlertTriangle className="w-8 h-8 text-destructive/40" />
              </div>
            </Card>
          </div>

          {/* Today's Attendance Report */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Present Students */}
            <Card className="p-6">
              <h3 className="text-lg font-semibold text-foreground mb-4">Present Students</h3>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {adminData && (() => {
                  const records = localStorage.getItem('attendanceRecords')
                  const today = new Date().toISOString().split('T')[0]
                  if (!records) return <p className="text-foreground/60 text-sm">No attendance records yet</p>
                  
                  const parsed = JSON.parse(records)
                  const todayRecords = parsed.filter((r: any) => r.date === today)
                  const presentIds = new Set(todayRecords.map((r: any) => r.studentId))
                  const presentStudents = adminData.students.filter((s: any) => presentIds.has(s.id))
                  
                  if (presentStudents.length === 0) {
                    return <p className="text-foreground/60 text-sm">No students marked present yet</p>
                  }
                  
                  return presentStudents.map((student: any) => (
                    <div key={student.id} className="flex items-center justify-between p-2 bg-primary/5 rounded border border-primary/20">
                      <div>
                        <p className="font-medium text-foreground">{student.name}</p>
                        <p className="text-xs text-foreground/50">{student.rollNumber || 'N/A'}</p>
                      </div>
                      <span className="text-xs font-semibold text-primary">✓ Present</span>
                    </div>
                  ))
                })()}
              </div>
            </Card>

            {/* Absent Students */}
            <Card className="p-6">
              <h3 className="text-lg font-semibold text-foreground mb-4">Absent Students</h3>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {adminData && (() => {
                  const records = localStorage.getItem('attendanceRecords')
                  const today = new Date().toISOString().split('T')[0]
                  
                  const parsed = records ? JSON.parse(records) : []
                  const todayRecords = parsed.filter((r: any) => r.date === today)
                  const presentIds = new Set(todayRecords.map((r: any) => r.studentId))
                  const absentStudents = adminData.students.filter((s: any) => !presentIds.has(s.id))
                  
                  if (absentStudents.length === 0) {
                    return <p className="text-foreground/60 text-sm">All students present</p>
                  }
                  
                  return absentStudents.map((student: any) => (
                    <div key={student.id} className="flex items-center justify-between p-2 bg-destructive/5 rounded border border-destructive/20">
                      <div>
                        <p className="font-medium text-foreground">{student.name}</p>
                        <p className="text-xs text-foreground/50">{student.rollNumber || 'N/A'}</p>
                      </div>
                      <span className="text-xs font-semibold text-destructive">✗ Absent</span>
                    </div>
                  ))
                })()}
              </div>
            </Card>
          </div>
        </>
      )}
    </div>
  )
}
