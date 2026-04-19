"use client"

import { Card } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  CheckCircle,
  Clock,
  AlertCircle,
  BookOpen,
  Award,
  ChevronRight,
  GraduationCap,
  CalendarRange,
} from "lucide-react"
import { useState, useEffect, useMemo, useCallback } from "react"
import { StudentFacialScanner } from "@/components/attendance/student-facial-scanner"
import type { Announcement } from "@/components/admin/announcements-manager"
import type { FeeInvoice } from "@/components/admin/fee-manager"
import { Input } from "@/components/ui/input"

type EnrolledCourse = {
  id: string
  name: string
  teacher: string
  day?: string
  startTime?: string
  endTime?: string
  scheduleLabel: string
}

function formatSchedule(cls: {
  day?: string
  startTime?: string
  endTime?: string
}): string {
  if (!cls.day && !cls.startTime && !cls.endTime) return "Schedule not set in admin"
  const time =
    cls.startTime && cls.endTime ? `${cls.startTime} – ${cls.endTime}` : cls.startTime || cls.endTime || ""
  return [cls.day, time].filter(Boolean).join(" · ")
}

function weekdayName(d: Date) {
  return d.toLocaleDateString(undefined, { weekday: "long" })
}

function parseRecordDate(dateStr: string): Date {
  const [y, m, day] = dateStr.split("-").map(Number)
  return new Date(y, (m || 1) - 1, day || 1)
}

/** Maps course percentage (0–100) to a 4.0 grade point for CGPA (unweighted by credits). */
function percentageToGradePoint4(percent: number): number {
  const p = Math.max(0, Math.min(100, Math.round(percent)))
  if (p >= 93) return 4.0
  if (p >= 90) return 3.7
  if (p >= 87) return 3.3
  if (p >= 83) return 3.0
  if (p >= 80) return 2.7
  if (p >= 77) return 2.3
  if (p >= 73) return 2.0
  if (p >= 70) return 1.7
  if (p >= 67) return 1.3
  if (p >= 60) return 1.0
  return 0.0
}

/** Letter / band categories aligned with the 4.0 scale above (for student reference). */
const GPA_GRADE_CATEGORIES: { range: string; points: string; letter: string }[] = [
  { range: "93–100%", points: "4.0", letter: "A / A+" },
  { range: "90–92%", points: "3.7", letter: "A−" },
  { range: "87–89%", points: "3.3", letter: "B+" },
  { range: "83–86%", points: "3.0", letter: "B" },
  { range: "80–82%", points: "2.7", letter: "B−" },
  { range: "77–79%", points: "2.3", letter: "C+" },
  { range: "73–76%", points: "2.0", letter: "C" },
  { range: "70–72%", points: "1.7", letter: "C−" },
  { range: "67–69%", points: "1.3", letter: "D+" },
  { range: "60–66%", points: "1.0", letter: "D" },
  { range: "Below 60%", points: "0.0", letter: "F" },
]

function parseGradeDate(s?: string | null): Date | null {
  if (!s || typeof s !== "string") return null
  const trimmed = s.trim().split("T")[0]
  if (!trimmed) return null
  const parsed = Date.parse(trimmed)
  if (!Number.isNaN(parsed)) return new Date(parsed)
  try {
    return parseRecordDate(trimmed)
  } catch {
    return null
  }
}

type SemesterWindow = { start: Date; end: Date; label: string }

/** Jan–Jun = Term 1; Jul–Dec = Term 2 (calendar-based until admin adds formal terms). */
function getCurrentSemesterWindow(now: Date): SemesterWindow {
  const y = now.getFullYear()
  const m = now.getMonth()
  if (m < 6) {
    return {
      start: new Date(y, 0, 1, 0, 0, 0, 0),
      end: new Date(y, 5, 30, 23, 59, 59, 999),
      label: `Spring · Term 1 (${y})`,
    }
  }
  return {
    start: new Date(y, 6, 1, 0, 0, 0, 0),
    end: new Date(y, 11, 31, 23, 59, 59, 999),
    label: `Fall · Term 2 (${y})`,
  }
}

function isDateInSemester(d: Date, sem: SemesterWindow) {
  const t = d.getTime()
  return t >= sem.start.getTime() && t <= sem.end.getTime()
}

export function StudentPortal({
  activeSection = "overview",
}: {
  activeSection?: "overview" | "academic" | "fees"
}) {
  const [studentData, setStudentData] = useState<any>(null)
  const [attendanceMetrics, setAttendanceMetrics] = useState<any[]>([])
  const [enrolledCourses, setEnrolledCourses] = useState<EnrolledCourse[]>([])
  const [courseGrades, setCourseGrades] = useState<any[]>([])
  const [thisMonthAttendance, setThisMonthAttendance] = useState(0)
  const [classesTodayCount, setClassesTodayCount] = useState(0)
  const [currentUserId, setCurrentUserId] = useState<string>("")
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [feeInvoices, setFeeInvoices] = useState<FeeInvoice[]>([])
  const [payDialogOpen, setPayDialogOpen] = useState(false)
  const [payInvoiceId, setPayInvoiceId] = useState<string>("")
  const [payAmount, setPayAmount] = useState<string>("")
  const [paySlipFile, setPaySlipFile] = useState<File | null>(null)

  const [courseDialogOpen, setCourseDialogOpen] = useState(false)
  const [selectedCourse, setSelectedCourse] = useState<EnrolledCourse | null>(null)
  const [courseAttendanceRows, setCourseAttendanceRows] = useState<any[]>([])
  const [loadingCourseAttendance, setLoadingCourseAttendance] = useState(false)
  const showAcademicSection = activeSection === "academic"
  const showFeesSection = activeSection === "fees"
  const showOverviewSections = activeSection === "overview"

  useEffect(() => {
    const currentUser = localStorage.getItem("currentUser")
    if (currentUser) {
      try {
        const user = JSON.parse(currentUser)
        setCurrentUserId(user.studentId)
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

  useEffect(() => {
    const load = () => {
      try {
        const raw = localStorage.getItem("feeInvoices")
        if (!raw) {
          setFeeInvoices([])
          return
        }
        const parsed = JSON.parse(raw)
        setFeeInvoices(Array.isArray(parsed) ? parsed : [])
      } catch {
        setFeeInvoices([])
      }
    }
    load()
    const onStorage = () => load()
    window.addEventListener("storage", onStorage)
    return () => window.removeEventListener("storage", onStorage)
  }, [])

  const myInvoices = useMemo(() => {
    if (!currentUserId) return []
    return feeInvoices
      .filter((i) => String(i.studentId) === String(currentUserId))
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
  }, [feeInvoices, currentUserId])

  const pendingInvoices = useMemo(() => myInvoices.filter((i) => i.status !== "paid"), [myInvoices])
  const paidInvoices = useMemo(() => myInvoices.filter((i) => i.status === "paid"), [myInvoices])

  const payInvoice = (invoiceId: string) => {
    const inv = feeInvoices.find((i) => i.id === invoiceId)
    if (!inv) return
    setPayInvoiceId(invoiceId)
    setPayAmount(String(inv.balance ?? inv.totalAmount ?? 0))
    setPaySlipFile(null)
    setPayDialogOpen(true)
  }

  const fileToDataUrl = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result || ""))
      reader.onerror = () => reject(new Error("failed to read file"))
      reader.readAsDataURL(file)
    })

  const confirmPayment = async () => {
    const amt = Number(payAmount)
    if (!Number.isFinite(amt) || amt <= 0 || !paySlipFile) return
    if (paySlipFile.size > 3 * 1024 * 1024) {
      alert("Slip file is too large. Please upload a file up to 3MB.")
      return
    }

    let slipDataUrl = ""
    try {
      slipDataUrl = await fileToDataUrl(paySlipFile)
    } catch {
      alert("Could not read slip file. Please try again.")
      return
    }

    const updated = feeInvoices.map((i) => {
      if (i.id !== payInvoiceId) return i
      const balance = Number(i.balance ?? Math.max(0, (i.totalAmount ?? 0) - (i.amountPaid ?? 0)))
      const pay = Math.min(balance, Math.round(amt * 100) / 100)
      const submission = {
        id: `slip-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        amount: pay,
        submittedAt: new Date().toISOString(),
        slipName: paySlipFile.name,
        slipDataUrl,
        status: "pending" as const,
      }
      return {
        ...i,
        paymentSubmissions: [...(Array.isArray(i.paymentSubmissions) ? i.paymentSubmissions : []), submission],
      }
    })
    setFeeInvoices(updated)
    localStorage.setItem("feeInvoices", JSON.stringify(updated))
    setPayDialogOpen(false)
    setPayInvoiceId("")
    setPayAmount("")
    setPaySlipFile(null)
  }

  const downloadReceipt = (invoice: FeeInvoice) => {
    const last = invoice.payments?.[invoice.payments.length - 1]
    const html = `<!doctype html>
<html>
<head><meta charset="utf-8"><title>Receipt ${invoice.id}</title></head>
<body style="font-family: ui-sans-serif, system-ui; padding: 24px;">
  <h2>SmartClass Payment Receipt</h2>
  <p><strong>Receipt for:</strong> ${invoice.studentName} (${invoice.studentId})</p>
  <p><strong>Invoice:</strong> ${invoice.title}</p>
  <p><strong>Total:</strong> ${invoice.totalAmount}</p>
  <p><strong>Paid:</strong> ${invoice.amountPaid}</p>
  <p><strong>Balance:</strong> ${invoice.balance}</p>
  <p><strong>Status:</strong> ${invoice.status}</p>
  <hr/>
  <p><strong>Last payment:</strong> ${last ? last.amount : 0} on ${last ? new Date(last.paidAt).toLocaleString() : "-"}</p>
  <p style="color:#666; font-size: 12px;">Generated at ${new Date().toLocaleString()}</p>
</body>
</html>`
    const blob = new Blob([html], { type: "text/html;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `receipt-${invoice.studentId}-${invoice.id}.html`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  const loadGradesAndCourses = useCallback(
    (parsed: any, currentStudent: any, gradesDataStr: string | null) => {
      const enrolledClasses: string[] =
        currentStudent.classIds || (currentStudent.classId ? [currentStudent.classId] : [])

      const courses: EnrolledCourse[] = (parsed.classes || [])
        .filter((cls: any) => enrolledClasses.includes(cls.id))
        .map((cls: any) => ({
          id: cls.id,
          name: cls.name,
          teacher: cls.classTeacher,
          day: cls.day,
          startTime: cls.startTime,
          endTime: cls.endTime,
          scheduleLabel: formatSchedule(cls),
        }))

      setEnrolledCourses(courses)

      const todayWeekday = weekdayName(new Date())
      const todayCount = (parsed.classes || []).filter((cls: any) => {
        if (!enrolledClasses.includes(cls.id)) return false
        return cls.day && String(cls.day) === todayWeekday
      }).length
      setClassesTodayCount(todayCount)

      const gradesData = gradesDataStr ? JSON.parse(gradesDataStr) : []
      const studentGrades = gradesData.filter((g: any) => g.studentId === currentStudent.id)

      const courseGradesData: Record<string, any> = {}
      studentGrades.forEach((grade: any) => {
        if (!enrolledClasses.includes(grade.classId)) return
        if (!courseGradesData[grade.classId]) {
          courseGradesData[grade.classId] = {
            courseId: grade.classId,
            courseName: parsed.classes.find((c: any) => c.id === grade.classId)?.name || "Unknown Course",
            assessments: [] as any[],
            totalMarks: 0,
            maxMarks: 0,
          }
        }
        courseGradesData[grade.classId].assessments.push({
          category: grade.category,
          marks: grade.marks,
          maxMarks: grade.maxMarks,
          remarks: grade.remarks,
          date: grade.date,
        })
        courseGradesData[grade.classId].totalMarks += grade.marks
        courseGradesData[grade.classId].maxMarks += grade.maxMarks
      })

      const courseGradesArray = Object.values(courseGradesData).map((course: any) => ({
        ...course,
        percentage: course.maxMarks > 0 ? Math.round((course.totalMarks / course.maxMarks) * 100) : 0,
      }))
      setCourseGrades(courseGradesArray)
    },
    [],
  )

  useEffect(() => {
    if (!currentUserId) return

    const adminDataStr = localStorage.getItem("adminData")
    const gradesDataStr = localStorage.getItem("gradesData")

    if (adminDataStr) {
      try {
        const parsed = JSON.parse(adminDataStr)
        const currentStudent = parsed.students?.find((s: any) => s.id === currentUserId)
        if (currentStudent) {
          setStudentData(currentStudent)
          loadGradesAndCourses(parsed, currentStudent, gradesDataStr)
        }
      } catch (e) {
        console.error("[v0] Failed to load student data:", e)
      }
    }

    ;(async () => {
      try {
        const res = await fetch(`/api/attendance/records?studentId=${encodeURIComponent(currentUserId)}`)
        const json = await res.json().catch(() => ({}))
        if (!res.ok || !json?.ok || !Array.isArray(json?.data)) throw new Error(json?.error || "Bad response")

        const records = json.data
        const today = new Date()
        const currentMonth = today.getMonth()
        const currentYear = today.getFullYear()

        const thisMonthCount = records.filter((r: any) => {
          const recordDate = new Date(r.date)
          return recordDate.getMonth() === currentMonth && recordDate.getFullYear() === currentYear
        }).length

        const totalDaysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate()
        const attendancePercentage = Math.round((thisMonthCount / totalDaysInMonth) * 100)
        setThisMonthAttendance(attendancePercentage)

        const months: any[] = []
        for (let i = 3; i >= 0; i--) {
          const date = new Date(today.getFullYear(), today.getMonth() - i, 1)
          const monthName = date.toLocaleString("default", { month: "long" })
          const monthDays = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
          const monthCount = records.filter((r: any) => {
            const recordDate = new Date(r.date)
            return recordDate.getMonth() === date.getMonth() && recordDate.getFullYear() === date.getFullYear()
          }).length
          const percentage = Math.round((monthCount / monthDays) * 100) || 0
          months.push({ month: monthName, percentage })
        }
        setAttendanceMetrics(months)
      } catch (e) {
        const attendanceRecords = localStorage.getItem("attendanceRecords")
        if (!attendanceRecords) return
        try {
          const records = JSON.parse(attendanceRecords)
          const studentAttendance = records.filter((r: any) => r.studentId === currentUserId)
          const today = new Date()
          const currentMonth = today.getMonth()
          const currentYear = today.getFullYear()

          const thisMonthCount = studentAttendance.filter((r: any) => {
            const recordDate = new Date(r.date)
            return recordDate.getMonth() === currentMonth && recordDate.getFullYear() === currentYear
          }).length

          const totalDaysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate()
          const attendancePercentage = Math.round((thisMonthCount / totalDaysInMonth) * 100)
          setThisMonthAttendance(attendancePercentage)

          const months: any[] = []
          for (let i = 3; i >= 0; i--) {
            const date = new Date(today.getFullYear(), today.getMonth() - i, 1)
            const monthName = date.toLocaleString("default", { month: "long" })
            const monthDays = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
            const monthCount = studentAttendance.filter((r: any) => {
              const recordDate = new Date(r.date)
              return recordDate.getMonth() === date.getMonth() && recordDate.getFullYear() === date.getFullYear()
            }).length
            const percentage = Math.round((monthCount / monthDays) * 100) || 0
            months.push({ month: monthName, percentage })
          }
          setAttendanceMetrics(months)
        } catch (err) {
          console.error("[v0] Failed to load attendance records:", err)
        }
      }
    })()
  }, [currentUserId, loadGradesAndCourses])

  useEffect(() => {
    if (!currentUserId) return

    const refreshAttendanceMetrics = () => {
      ;(async () => {
        try {
          const res = await fetch(`/api/attendance/records?studentId=${encodeURIComponent(currentUserId)}`)
          const json = await res.json().catch(() => ({}))
          if (!res.ok || !json?.ok || !Array.isArray(json?.data)) throw new Error(json?.error || "Bad response")

          const records = json.data
          const today = new Date()
          const currentMonth = today.getMonth()
          const currentYear = today.getFullYear()

          const thisMonthCount = records.filter((r: any) => {
            const recordDate = new Date(r.date)
            return recordDate.getMonth() === currentMonth && recordDate.getFullYear() === currentYear
          }).length

          const totalDaysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate()
          const attendancePercentage = Math.round((thisMonthCount / totalDaysInMonth) * 100)
          setThisMonthAttendance(attendancePercentage)

          const months: any[] = []
          for (let i = 3; i >= 0; i--) {
            const date = new Date(today.getFullYear(), today.getMonth() - i, 1)
            const monthName = date.toLocaleString("default", { month: "long" })
            const monthDays = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
            const monthCount = records.filter((r: any) => {
              const recordDate = new Date(r.date)
              return recordDate.getMonth() === date.getMonth() && recordDate.getFullYear() === date.getFullYear()
            }).length
            const percentage = Math.round((monthCount / monthDays) * 100) || 0
            months.push({ month: monthName, percentage })
          }
          setAttendanceMetrics(months)
        } catch (e) {
          const attendanceRecords = localStorage.getItem("attendanceRecords")
          if (!attendanceRecords) return
          try {
            const records = JSON.parse(attendanceRecords)
            const today = new Date()
            const currentMonth = today.getMonth()
            const currentYear = today.getFullYear()
            const studentAttendance = records.filter((r: any) => r.studentId === currentUserId)

            const thisMonthCount = studentAttendance.filter((r: any) => {
              const recordDate = new Date(r.date)
              return recordDate.getMonth() === currentMonth && recordDate.getFullYear() === currentYear
            }).length

            const totalDaysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate()
            const attendancePercentage = Math.round((thisMonthCount / totalDaysInMonth) * 100)
            setThisMonthAttendance(attendancePercentage)
          } catch (err) {
            console.error("[v0] Failed to refresh attendance metrics:", err)
          }
        }
      })()
    }

    refreshAttendanceMetrics()
    const interval = setInterval(refreshAttendanceMetrics, 2500)
    return () => clearInterval(interval)
  }, [currentUserId])

  const overallGradePercent = useMemo(() => {
    if (!courseGrades.length) return null
    const totalMarks = courseGrades.reduce((s, c) => s + (c.totalMarks || 0), 0)
    const maxMarks = courseGrades.reduce((s, c) => s + (c.maxMarks || 0), 0)
    if (maxMarks <= 0) return null
    return Math.round((totalMarks / maxMarks) * 100)
  }, [courseGrades])

  /** Cumulative GPA on a 4.0 scale: unweighted mean of per-course grade points from admin evaluations. */
  const cgpa = useMemo(() => {
    const graded = courseGrades.filter((c) => (c.maxMarks || 0) > 0 && typeof c.percentage === "number")
    if (!graded.length) return null
    const sum = graded.reduce((s, c) => s + percentageToGradePoint4(c.percentage), 0)
    return sum / graded.length
  }, [courseGrades])

  /** Semester GPA: same 4.0 scale, but only assessments dated inside the current calendar semester. */
  const { semesterWindow, semesterGpa, semesterGradedCourseCount } = useMemo(() => {
    const sem = getCurrentSemesterWindow(new Date())
    const coursePercents: number[] = []
    for (const course of courseGrades) {
      const assessments = (course.assessments || []) as any[]
      const inSem = assessments.filter((a) => {
        const d = parseGradeDate(a?.date)
        if (!d) return false
        return isDateInSemester(d, sem)
      })
      const t = inSem.reduce((s, a) => s + (Number(a.marks) || 0), 0)
      const m = inSem.reduce((s, a) => s + (Number(a.maxMarks) || 0), 0)
      if (m > 0) coursePercents.push(Math.round((t / m) * 100))
    }
    if (!coursePercents.length) {
      return { semesterWindow: sem, semesterGpa: null as number | null, semesterGradedCourseCount: 0 }
    }
    const sum = coursePercents.reduce((s, p) => s + percentageToGradePoint4(p), 0)
    return {
      semesterWindow: sem,
      semesterGpa: sum / coursePercents.length,
      semesterGradedCourseCount: coursePercents.length,
    }
  }, [courseGrades])

  const selectedCourseGradeDetail = useMemo(() => {
    if (!selectedCourse) return null
    return courseGrades.find((c) => c.courseId === selectedCourse.id) || null
  }, [selectedCourse, courseGrades])

  const openCourseDetail = (course: EnrolledCourse) => {
    setSelectedCourse(course)
    setCourseDialogOpen(true)
  }

  useEffect(() => {
    if (!courseDialogOpen || !selectedCourse || !currentUserId) {
      setCourseAttendanceRows([])
      return
    }

    let cancelled = false
    setLoadingCourseAttendance(true)

    const load = async () => {
      try {
        const res = await fetch(
          `/api/attendance/records?studentId=${encodeURIComponent(currentUserId)}&classId=${encodeURIComponent(selectedCourse.id)}`,
        )
        const json = await res.json().catch(() => ({}))
        if (res.ok && json?.ok && Array.isArray(json.data)) {
          const sorted = [...json.data].sort((a: any, b: any) => String(b.date).localeCompare(String(a.date)))
          if (!cancelled) setCourseAttendanceRows(sorted)
          return
        }
        throw new Error("fallback")
      } catch {
        try {
          const raw = localStorage.getItem("attendanceRecords")
          if (!raw) {
            if (!cancelled) setCourseAttendanceRows([])
            return
          }
          const all = JSON.parse(raw) as any[]
          const filtered = all.filter(
            (r) => r.studentId === currentUserId && r.classId === selectedCourse.id,
          )
          filtered.sort((a, b) => String(b.date).localeCompare(String(a.date)))
          if (!cancelled) setCourseAttendanceRows(filtered)
        } catch {
          if (!cancelled) setCourseAttendanceRows([])
        }
      } finally {
        if (!cancelled) setLoadingCourseAttendance(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [courseDialogOpen, selectedCourse, currentUserId])

  const reloadAdminAndGrades = useCallback(() => {
    const adminDataStr = localStorage.getItem("adminData")
    const gradesDataStr = localStorage.getItem("gradesData")
    if (!adminDataStr || !currentUserId) return
    try {
      const parsed = JSON.parse(adminDataStr)
      const currentStudent = parsed.students?.find((s: any) => s.id === currentUserId)
      if (currentStudent) {
        setStudentData(currentStudent)
        loadGradesAndCourses(parsed, currentStudent, gradesDataStr)
      }
    } catch {
      // ignore
    }
  }, [currentUserId, loadGradesAndCourses])

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === "adminData" || e.key === "gradesData") reloadAdminAndGrades()
    }
    window.addEventListener("storage", onStorage)
    return () => window.removeEventListener("storage", onStorage)
  }, [reloadAdminAndGrades])

  useEffect(() => {
    const onFocus = () => reloadAdminAndGrades()
    window.addEventListener("focus", onFocus)
    return () => window.removeEventListener("focus", onFocus)
  }, [reloadAdminAndGrades])

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-3xl font-bold text-foreground tracking-tight">My Portal</h2>
          <p className="text-foreground/60">
            {studentData ? `Welcome back, ${studentData.name}` : "Your attendance and academic engagement"}
          </p>
        </div>
        <Badge variant="outline" className="bg-transparent">
          {currentUserId ? `Student ID: ${currentUserId}` : "Not linked"}
        </Badge>
      </div>

      <div className="space-y-8">
        <div className="min-w-0 space-y-8">
          {showFeesSection ? (
            <Card id="fees-invoices" variant="glass" className="p-6">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-foreground">Fees & invoices</p>
              <Badge variant="outline" className="bg-transparent">
                {myInvoices.length}
              </Badge>
            </div>
            <div className="mt-3 space-y-2">
              {myInvoices.length === 0 ? (
                <p className="text-sm text-foreground/60">No invoices yet.</p>
              ) : (
                <>
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-foreground/70">Pending invoices</p>
                    {pendingInvoices.length === 0 ? (
                      <p className="text-xs text-foreground/60">No pending invoices.</p>
                    ) : (
                      pendingInvoices.slice(0, 6).map((i) => (
                        <div
                          key={i.id}
                          className="rounded-xl border border-[var(--glass-border)] bg-[var(--glass-bg)] backdrop-blur-xl p-4"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="text-sm font-semibold text-foreground">{i.title}</p>
                                <Badge variant="outline" className="bg-transparent text-[10px] h-5">
                                  {i.status === "partial" ? "PARTIAL" : "UNPAID"}
                                </Badge>
                              </div>
                              <p className="text-xs text-foreground/60 mt-1">
                                Total: <span className="text-foreground font-medium">{i.totalAmount}</span> · Paid:{" "}
                                <span className="text-foreground font-medium">{i.amountPaid}</span> · Balance:{" "}
                                <span className="text-foreground font-medium">{i.balance}</span> · Due: {i.dueDate}
                              </p>
                              {(i.paymentSubmissions || []).some((s) => s.status === "pending") ? (
                                <p className="text-[10px] text-amber-600 mt-2">Slip submitted. Waiting for admin verification.</p>
                              ) : null}
                            </div>
                            <Button size="sm" className="rounded-xl" onClick={() => payInvoice(i.id)}>
                              Pay
                            </Button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  <div className="space-y-2 pt-3">
                    <p className="text-xs font-semibold text-foreground/70">Paid invoices</p>
                    {paidInvoices.length === 0 ? (
                      <p className="text-xs text-foreground/60">No paid invoices yet.</p>
                    ) : (
                      paidInvoices.slice(0, 6).map((i) => (
                        <div
                          key={i.id}
                          className="rounded-xl border border-[var(--glass-border)] bg-[var(--glass-bg)] backdrop-blur-xl p-4"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="text-sm font-semibold text-foreground">{i.title}</p>
                                <Badge className="text-[10px] h-5">PAID</Badge>
                              </div>
                              <p className="text-xs text-foreground/60 mt-1">
                                Total: <span className="text-foreground font-medium">{i.totalAmount}</span> · Paid:{" "}
                                <span className="text-foreground font-medium">{i.amountPaid}</span> · Due: {i.dueDate}
                              </p>
                              {i.payments?.length ? (
                                <p className="text-[10px] text-foreground/50 mt-2">
                                  Last payment: {new Date(i.payments[i.payments.length - 1].paidAt).toLocaleString()}
                                </p>
                              ) : null}
                            </div>
                            {i.payments?.length ? (
                              <Button size="sm" variant="outline" className="rounded-xl" onClick={() => downloadReceipt(i)}>
                                Download receipt
                              </Button>
                            ) : null}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </>
              )}
            </div>
            </Card>
          ) : null}

          <Dialog open={payDialogOpen} onOpenChange={setPayDialogOpen}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Pay fee</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <p className="text-sm text-foreground/70">
                  Enter amount and upload paid fee slip. Admin will verify and then mark this invoice as paid.
                </p>
                <Input value={payAmount} onChange={(e) => setPayAmount(e.target.value)} inputMode="decimal" />
                <Input
                  type="file"
                  accept=".jpg,.jpeg,.png,.webp,.pdf"
                  onChange={(e) => setPaySlipFile(e.target.files?.[0] || null)}
                />
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setPayDialogOpen(false)} className="rounded-xl">
                    Cancel
                  </Button>
                  <Button onClick={confirmPayment} className="rounded-xl" disabled={!paySlipFile}>
                    Submit slip
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
      {showOverviewSections ? <StudentFacialScanner /> : null}

      {showOverviewSections ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        <Card variant="glass" className="p-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <CheckCircle className="w-6 h-6 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="text-sm text-foreground/60">This Month</p>
              <p className="text-2xl font-bold text-foreground">{thisMonthAttendance}%</p>
            </div>
          </div>
        </Card>
        <Card variant="glass" className="p-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">
              <Clock className="w-6 h-6 text-accent" />
            </div>
            <div className="min-w-0">
              <p className="text-sm text-foreground/60">Classes today (scheduled)</p>
              <p className="text-2xl font-bold text-foreground">{classesTodayCount}</p>
            </div>
          </div>
        </Card>
        <Card variant="glass" className="p-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-accent/15 flex items-center justify-center shrink-0">
              <CalendarRange className="w-6 h-6 text-accent" />
            </div>
            <div className="min-w-0">
              <p className="text-sm text-foreground/60">GPA (this semester)</p>
              <p className="text-2xl font-bold text-primary tabular-nums">
                {semesterGpa !== null ? semesterGpa.toFixed(2) : "—"}
              </p>
              <p className="text-xs text-foreground/50 mt-0.5">out of 4.00 · {semesterWindow.label}</p>
            </div>
          </div>
        </Card>
        <Card variant="glass" className="p-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <GraduationCap className="w-6 h-6 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="text-sm text-foreground/60">CGPA (cumulative)</p>
              <p className="text-2xl font-bold text-primary tabular-nums">
                {cgpa !== null ? cgpa.toFixed(2) : "—"}
              </p>
              <p className="text-xs text-foreground/50 mt-0.5">out of 4.00 · all courses</p>
            </div>
          </div>
        </Card>
        <Card variant="glass" className="p-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <AlertCircle className="w-6 h-6 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="text-sm text-foreground/60">Status</p>
              <p className="text-2xl font-bold text-primary">Active</p>
            </div>
          </div>
        </Card>
        </div>
      ) : null}

      {showOverviewSections ? (
        <Card variant="glass" className="p-6">
        <h3 className="text-lg font-semibold text-foreground mb-4">My enrolled courses</h3>
        <p className="text-sm text-foreground/60 mb-4">
          Schedule comes from admin class data. Click a course to see attendance by date and assessment marks.
        </p>
        {enrolledCourses.length === 0 ? (
          <p className="text-foreground/60">No courses enrolled yet.</p>
        ) : (
          <div className="space-y-3">
            {enrolledCourses.map((cls) => (
              <button
                key={cls.id}
                type="button"
                onClick={() => openCourseDetail(cls)}
                className="w-full flex items-center justify-between gap-4 p-4 rounded-xl bg-[var(--glass-bg)] border border-[var(--glass-border)] backdrop-blur-xl hover:bg-[var(--glass-bg-strong)] hover:border-primary/25 transition-colors text-left"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-foreground">{cls.name}</p>
                  <p className="text-sm text-foreground/60 mt-1">Teacher: {cls.teacher}</p>
                  <p className="text-sm text-foreground/80 mt-1">
                    <Clock className="inline w-3.5 h-3.5 mr-1 align-text-bottom text-primary" />
                    {cls.scheduleLabel}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge className="bg-primary/20 text-primary">Enrolled</Badge>
                  <ChevronRight className="w-5 h-5 text-foreground/40" />
                </div>
              </button>
            ))}
          </div>
        )}
        </Card>
      ) : null}

      {showOverviewSections ? (
        <Card variant="glass" className="p-6">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-semibold text-foreground">Announcements</p>
          <Badge variant="outline" className="bg-transparent">
            {announcements.filter((a) => a.audience === "all" || a.audience === "students").length}
          </Badge>
        </div>
        <div className="mt-3 space-y-2">
          {announcements
            .filter((a) => a.audience === "all" || a.audience === "students")
            .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
            .slice(0, 3)
            .map((a) => (
              <div
                key={a.id}
                className="rounded-xl border border-[var(--glass-border)] bg-[var(--glass-bg)] backdrop-blur-xl p-4 hover:bg-[var(--glass-bg-strong)] transition-colors"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-foreground">{a.title}</p>
                  <Badge variant="outline" className="bg-transparent text-[10px] h-5">
                    {a.category}
                  </Badge>
                </div>
                <p className="text-sm text-foreground/70 mt-1 whitespace-pre-wrap">{a.message}</p>
                <p className="text-xs text-foreground/50 mt-2">{new Date(a.createdAt).toLocaleString()}</p>
              </div>
            ))}
          {announcements.filter((a) => a.audience === "all" || a.audience === "students").length === 0 ? (
            <p className="text-sm text-foreground/60">No announcements yet.</p>
          ) : null}
        </div>
        </Card>
      ) : null}

      {showOverviewSections ? (
        <Card variant="glass" className="p-6">
        <h3 className="text-lg font-semibold text-foreground mb-4">Attendance history (last 4 months)</h3>
        {attendanceMetrics.length === 0 ? (
          <p className="text-foreground/60 text-center py-8">No attendance records yet</p>
        ) : (
          <div className="flex items-end justify-between h-32 gap-2">
            {attendanceMetrics.map((month, index) => (
              <div key={index} className="flex-1 flex flex-col items-center gap-2">
                <div
                  className="w-full bg-gradient-to-t from-primary to-primary rounded-t relative transition-transform hover:scale-[1.02]"
                  style={{ height: `${Math.max(month.percentage, 5)}%` }}
                >
                  <span className="absolute -top-6 left-1/2 -translate-x-1/2 text-xs font-semibold text-foreground">
                    {month.percentage}%
                  </span>
                </div>
                <p className="text-xs text-foreground/60">{month.month}</p>
              </div>
            ))}
          </div>
        )}
        </Card>
      ) : null}

        </div>

        {showAcademicSection ? (
          <Card
          id="academic-performance"
          variant="glass"
          className="p-5 lg:p-5 border-[var(--glass-border)] shadow-sm lg:shadow-sm"
        >
            <h3 className="text-base font-semibold text-foreground mb-1">Academic performance</h3>
            <p className="text-xs text-foreground/60 mb-4 leading-relaxed">
              From admin data only.{" "}
              <span className="text-foreground/75">
                <strong className="font-medium text-foreground">GPA</strong> = semester (dated assessments).{" "}
                <strong className="font-medium text-foreground">CGPA</strong> = cumulative. Official values after term-end
                evaluation.
              </span>
            </p>
            <div className="space-y-5">
              <div>
                <div className="flex items-center justify-between mb-1.5 gap-2">
                  <p className="text-xs font-medium text-foreground">Attendance (this month)</p>
                  <p className="text-xs font-semibold text-primary tabular-nums">{thisMonthAttendance}%</p>
                </div>
                <Progress value={thisMonthAttendance} max={100} className="h-1.5" />
              </div>
              {overallGradePercent !== null ? (
                <>
                  <div>
                    <div className="flex items-center justify-between mb-1.5 gap-2">
                      <p className="text-xs font-medium text-foreground">Grade average (all courses)</p>
                      <p className="text-xs font-semibold text-primary tabular-nums">{overallGradePercent}%</p>
                    </div>
                    <Progress value={overallGradePercent} max={100} className="h-1.5" />
                  </div>

                  <div>
                    <p className="text-xs font-semibold text-foreground mb-2">GPA & CGPA</p>
                    <div className="grid grid-cols-1 gap-3">
                      <div className="rounded-xl border border-[var(--glass-border)] bg-[var(--glass-bg)] backdrop-blur-xl p-3 space-y-1.5">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <p className="text-xs font-medium text-foreground">Semester GPA</p>
                          <Badge variant="outline" className="shrink-0 text-[10px] px-1.5 py-0 h-5">
                            Term
                          </Badge>
                        </div>
                        <p className="text-[11px] text-foreground/55">{semesterWindow.label}</p>
                        {semesterGpa !== null ? (
                          <>
                            <p className="text-xl font-bold text-primary tabular-nums">
                              {semesterGpa.toFixed(2)}
                              <span className="text-xs font-normal text-foreground/60"> / 4.00</span>
                            </p>
                            <p className="text-[11px] text-foreground/60 leading-snug">
                              {semesterGradedCourseCount} course{semesterGradedCourseCount === 1 ? "" : "s"} this term.
                            </p>
                          </>
                        ) : (
                          <p className="text-[11px] text-foreground/60 leading-snug">
                            No dated marks in this term yet.
                          </p>
                        )}
                      </div>

                      <div className="rounded-xl border border-[var(--glass-border)] bg-[var(--glass-bg)] backdrop-blur-xl p-3 space-y-1.5">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <p className="text-xs font-medium text-foreground">CGPA</p>
                          <Badge variant="outline" className="shrink-0 text-[10px] px-1.5 py-0 h-5">
                            All terms
                          </Badge>
                        </div>
                        {cgpa !== null ? (
                          <>
                            <p className="text-xl font-bold text-primary tabular-nums">
                              {cgpa.toFixed(2)}
                              <span className="text-xs font-normal text-foreground/60"> / 4.00</span>
                            </p>
                            <p className="text-[11px] text-foreground/60 leading-snug">
                              Unweighted across evaluated courses.
                            </p>
                          </>
                        ) : (
                          <p className="text-[11px] text-foreground/60">No marks yet.</p>
                        )}
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <p className="text-xs text-foreground/60">No assessment marks for your courses yet.</p>
              )}

              <div className="rounded-xl border border-[var(--glass-border)] bg-[var(--glass-bg)] backdrop-blur-xl overflow-hidden">
                <div className="px-3 py-2 border-b border-[var(--glass-border)] bg-[var(--glass-bg-strong)]">
                  <p className="text-xs font-semibold text-foreground">4.0 grade scale</p>
                  <p className="text-[10px] text-foreground/55 mt-0.5">Course % → points</p>
                </div>
                <div className="max-h-56 overflow-y-auto p-2 space-y-1">
                  {GPA_GRADE_CATEGORIES.map((row) => (
                    <div
                      key={row.range}
                      className="grid grid-cols-[1fr_auto_auto] items-center gap-2 rounded-lg border border-[var(--glass-border)] bg-[var(--glass-bg)] px-2.5 py-2 hover:bg-[var(--glass-bg-strong)] transition-colors"
                    >
                      <div className="min-w-0">
                        <p className="text-[11px] font-medium text-foreground truncate">{row.range}</p>
                        <p className="text-[10px] text-foreground/55 truncate">{row.letter}</p>
                      </div>
                      <Badge variant="outline" className="bg-transparent text-[10px] h-5 px-2 tabular-nums">
                        {row.points}
                      </Badge>
                      <span className="text-[10px] text-foreground/60">pts</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Card>
        ) : null}
      </div>

      <Dialog
        open={courseDialogOpen}
        onOpenChange={(open) => {
          setCourseDialogOpen(open)
          if (!open) setSelectedCourse(null)
        }}
      >
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="pr-8">{selectedCourse?.name || "Course"}</DialogTitle>
            <p className="text-sm text-foreground/60">
              {selectedCourse?.scheduleLabel}
              {selectedCourse?.teacher ? ` · ${selectedCourse.teacher}` : ""}
            </p>
          </DialogHeader>

          <div className="space-y-6 pt-2">
            <div>
              <h4 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
                <BookOpen className="w-4 h-4" />
                Attendance
              </h4>
              {loadingCourseAttendance ? (
                <p className="text-sm text-foreground/60">Loading attendance…</p>
              ) : courseAttendanceRows.length === 0 ? (
                <p className="text-sm text-foreground/60">No attendance records for this course yet.</p>
              ) : (
                <div className="rounded-md border border-border overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/40">
                        <th className="text-left py-2 px-3 font-medium">Date</th>
                        <th className="text-left py-2 px-3 font-medium">Day</th>
                        <th className="text-left py-2 px-3 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {courseAttendanceRows.map((row: any, idx: number) => {
                        const dateStr = String(row.date || "")
                        let dayLabel = "—"
                        try {
                          if (dateStr) dayLabel = weekdayName(parseRecordDate(dateStr))
                        } catch {
                          dayLabel = "—"
                        }
                        return (
                          <tr key={`${row.date}-${idx}`} className="border-b border-border/60 last:border-0">
                            <td className="py-2 px-3 text-foreground">{dateStr}</td>
                            <td className="py-2 px-3 text-foreground/80">{dayLabel}</td>
                            <td className="py-2 px-3 capitalize">{row.status || "—"}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div>
              <h4 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
                <Award className="w-4 h-4" />
                Assessment marks
              </h4>
              {!selectedCourseGradeDetail || selectedCourseGradeDetail.assessments.length === 0 ? (
                <p className="text-sm text-foreground/60">No marks uploaded for this course yet.</p>
              ) : (
                <div className="space-y-2">
                  {selectedCourseGradeDetail.assessments.map((a: any, aIdx: number) => (
                    <div
                      key={aIdx}
                      className="flex items-start justify-between gap-3 p-3 rounded-lg border border-border bg-background/50"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground">{a.category}</p>
                        {a.date && (
                          <p className="text-xs text-foreground/50 mt-0.5">{a.date}</p>
                        )}
                        {a.remarks && <p className="text-xs text-foreground/60 mt-1">{a.remarks}</p>}
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-semibold text-primary">
                          {a.marks}/{a.maxMarks}
                        </p>
                        <p className="text-xs text-foreground/60">
                          {a.maxMarks > 0 ? Math.round((a.marks / a.maxMarks) * 100) : 0}%
                        </p>
                      </div>
                    </div>
                  ))}
                  <div className="flex justify-between items-center pt-2 border-t border-border">
                    <span className="text-sm text-foreground/60">Course total</span>
                    <span className="text-sm font-semibold text-primary">
                      {selectedCourseGradeDetail.percentage}% ({selectedCourseGradeDetail.totalMarks}/
                      {selectedCourseGradeDetail.maxMarks})
                    </span>
                  </div>
                </div>
              )}
            </div>

            <Button type="button" variant="outline" className="w-full" onClick={() => setCourseDialogOpen(false)}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
