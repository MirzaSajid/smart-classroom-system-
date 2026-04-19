"use client"

import { useEffect, useMemo, useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Trash2, Receipt, CheckCircle2, Clock, Users } from "lucide-react"

type FeeStatus = "unpaid" | "partial" | "paid"

export type FeePayment = {
  id: string
  amount: number
  paidAt: string
  method: "cash" | "card" | "online"
  note?: string
}

export type FeePaymentSubmission = {
  id: string
  amount: number
  submittedAt: string
  slipName: string
  slipDataUrl: string
  status: "pending" | "approved" | "rejected"
  verifiedAt?: string
}

export type FeeInvoice = {
  id: string
  studentId: string
  studentName: string
  title: string
  totalAmount: number
  dueDate: string
  status: FeeStatus
  createdAt: string
  amountPaid: number
  balance: number
  payments: FeePayment[]
  paymentSubmissions: FeePaymentSubmission[]
}

const LS_KEY = "feeInvoices"
const COURSE_FEE = 30000

function normalizeInvoice(raw: any): FeeInvoice | null {
  if (!raw || typeof raw !== "object") return null
  const totalAmount = Number(raw.totalAmount ?? raw.amount)
  if (!Number.isFinite(totalAmount) || totalAmount <= 0) return null
  const payments: FeePayment[] = Array.isArray(raw.payments)
    ? raw.payments
        .map((p: any) => {
          const amt = Number(p?.amount)
          if (!Number.isFinite(amt) || amt <= 0) return null
          return {
            id: String(p?.id || `pay-${Math.random().toString(36).slice(2, 9)}`),
            amount: Math.round(amt * 100) / 100,
            paidAt: String(p?.paidAt || new Date().toISOString()),
            method: (p?.method as FeePayment["method"]) || "online",
            note: typeof p?.note === "string" ? p.note : undefined,
          } satisfies FeePayment
        })
        .filter(Boolean) as FeePayment[]
    : []
  const paymentSubmissions: FeePaymentSubmission[] = Array.isArray(raw.paymentSubmissions)
    ? raw.paymentSubmissions
        .map((s: any) => {
          const amt = Number(s?.amount)
          if (!Number.isFinite(amt) || amt <= 0) return null
          return {
            id: String(s?.id || `slip-${Math.random().toString(36).slice(2, 9)}`),
            amount: Math.round(amt * 100) / 100,
            submittedAt: String(s?.submittedAt || new Date().toISOString()),
            slipName: String(s?.slipName || "fee-slip"),
            slipDataUrl: String(s?.slipDataUrl || ""),
            status:
              s?.status === "approved" || s?.status === "rejected" || s?.status === "pending"
                ? s.status
                : "pending",
            verifiedAt: typeof s?.verifiedAt === "string" ? s.verifiedAt : undefined,
          } satisfies FeePaymentSubmission
        })
        .filter(Boolean) as FeePaymentSubmission[]
    : []

  const amountPaid =
    Number.isFinite(Number(raw.amountPaid)) ? Number(raw.amountPaid) : payments.reduce((s, p) => s + p.amount, 0)
  const paid = Math.max(0, Math.round(amountPaid * 100) / 100)
  const balance = Math.max(0, Math.round((totalAmount - paid) * 100) / 100)

  const status: FeeStatus = balance <= 0 ? "paid" : paid > 0 ? "partial" : "unpaid"

  return {
    id: String(raw.id || `fee-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`),
    studentId: String(raw.studentId || ""),
    studentName: String(raw.studentName || raw.studentId || ""),
    title: String(raw.title || "Fee"),
    totalAmount: Math.round(totalAmount * 100) / 100,
    dueDate: String(raw.dueDate || new Date().toISOString().slice(0, 10)),
    status,
    createdAt: String(raw.createdAt || new Date().toISOString()),
    amountPaid: Math.min(Math.round(paid * 100) / 100, Math.round(totalAmount * 100) / 100),
    balance,
    payments,
    paymentSubmissions,
  }
}

function loadInvoices(): FeeInvoice[] {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.map(normalizeInvoice).filter(Boolean) as FeeInvoice[]
  } catch {
    return []
  }
}

function saveInvoices(list: FeeInvoice[]) {
  localStorage.setItem(LS_KEY, JSON.stringify(list))
}

export function FeeManager() {
  const [adminData, setAdminData] = useState<any>(null)
  const [invoices, setInvoices] = useState<FeeInvoice[]>([])

  const [scope, setScope] = useState<"single" | "class" | "all">("single")
  const [studentId, setStudentId] = useState("")
  const [classId, setClassId] = useState("")
  const [title, setTitle] = useState("Tuition Fee")
  const [dueDate, setDueDate] = useState(() => new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString().slice(0, 10))

  useEffect(() => {
    try {
      const raw = localStorage.getItem("adminData")
      setAdminData(raw ? JSON.parse(raw) : null)
    } catch {
      setAdminData(null)
    }
    setInvoices(loadInvoices())
  }, [])

  const students = useMemo(() => {
    const list = adminData?.students || []
    return Array.isArray(list) ? list : []
  }, [adminData])

  const classes = useMemo(() => {
    const list = adminData?.classes || []
    return Array.isArray(list) ? list : []
  }, [adminData])

  const sorted = useMemo(() => {
    return [...invoices].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
  }, [invoices])

  const targets = useMemo(() => {
    if (scope === "all") return students
    if (scope === "class") {
      if (!classId) return []
      return students.filter((s: any) => {
        const ids = Array.isArray(s?.classIds) ? s.classIds : s?.classId ? [s.classId] : []
        return ids.some((id: any) => String(id) === String(classId))
      })
    }
    if (!studentId) return []
    return students.filter((s: any) => String(s.id) === String(studentId))
  }, [scope, students, studentId, classId])

  const getCourseCount = (student: any) => {
    const ids = Array.isArray(student?.classIds) ? student.classIds : student?.classId ? [student.classId] : []
    return ids.filter(Boolean).length
  }

  const payableTargets = useMemo(() => {
    return targets
      .map((s: any) => ({ student: s, courseCount: getCourseCount(s) }))
      .filter((entry) => entry.courseCount > 0)
  }, [targets])

  const estimatedTotalAmount = useMemo(() => {
    return payableTargets.reduce((sum, entry) => sum + entry.courseCount * COURSE_FEE, 0)
  }, [payableTargets])

  const createInvoice = () => {
    const t = title.trim()
    if (!t || !dueDate) return
    if (payableTargets.length === 0) return

    const createdAt = new Date().toISOString()
    const created = payableTargets.map((entry) => {
      const sid = String(entry.student?.id || "").trim()
      const name = String(entry.student?.name || sid)
      const totalAmount = Math.round(entry.courseCount * COURSE_FEE * 100) / 100
      return {
        id: `fee-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        studentId: sid,
        studentName: name,
        title: `${t} (${entry.courseCount} course${entry.courseCount > 1 ? "s" : ""})`,
        totalAmount,
        dueDate,
        status: "unpaid" as const,
        createdAt,
        amountPaid: 0,
        balance: totalAmount,
        payments: [],
        paymentSubmissions: [],
      } satisfies FeeInvoice
    })

    const updated = [...created, ...invoices].slice(0, 2000)
    setInvoices(updated)
    saveInvoices(updated)
    setStudentId("")
    setClassId("")
    setScope("single")
  }

  const remove = (id: string) => {
    const updated = invoices.filter((i) => i.id !== id)
    setInvoices(updated)
    saveInvoices(updated)
  }

  const markPaid = (id: string) => {
    const updated = invoices.map((i) =>
      i.id === id
        ? {
            ...i,
            payments: [
              ...i.payments,
              {
                id: `pay-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
                amount: i.balance,
                paidAt: new Date().toISOString(),
                method: "cash" as const,
                note: "Marked paid by admin",
              },
            ],
            amountPaid: i.totalAmount,
            balance: 0,
            status: "paid" as const,
          }
        : i,
    )
    setInvoices(updated)
    saveInvoices(updated)
  }

  const verifySubmissionAndMarkPaid = (invoiceId: string, submissionId: string) => {
    const updated = invoices.map((inv) => {
      if (inv.id !== invoiceId) return inv
      const target = (inv.paymentSubmissions || []).find((s) => s.id === submissionId && s.status === "pending")
      if (!target) return inv

      const pay = Math.min(inv.balance, Math.round(target.amount * 100) / 100)
      const payment: FeePayment = {
        id: `pay-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        amount: pay,
        paidAt: new Date().toISOString(),
        method: "online",
        note: `Verified from slip: ${target.slipName}`,
      }
      const amountPaid = Math.round((inv.amountPaid + pay) * 100) / 100
      const balance = Math.max(0, Math.round((inv.totalAmount - amountPaid) * 100) / 100)
      const status: FeeStatus = balance <= 0 ? "paid" : amountPaid > 0 ? "partial" : "unpaid"

      return {
        ...inv,
        payments: [...inv.payments, payment],
        amountPaid,
        balance,
        status,
        paymentSubmissions: (inv.paymentSubmissions || []).map((s) =>
          s.id === submissionId ? { ...s, status: "approved" as const, verifiedAt: new Date().toISOString() } : s,
        ),
      }
    })
    setInvoices(updated)
    saveInvoices(updated)
  }

  return (
    <div className="space-y-4">
      <Card variant="glass" className="p-5">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Receipt className="w-4 h-4 text-primary" />
              <p className="text-sm font-semibold text-foreground">Create fee invoice</p>
            </div>
            <p className="text-xs text-foreground/60">Generate invoices for one student, a class, or everyone.</p>
          </div>
          <Badge variant="outline" className="bg-transparent">
            Total: {sorted.length}
          </Badge>
        </div>

        <div className="mt-4 grid grid-cols-1 lg:grid-cols-5 gap-3 items-end">
          <div className="lg:col-span-1">
            <p className="text-xs font-medium text-foreground mb-1">Scope</p>
            <select
              value={scope}
              onChange={(e) => setScope(e.target.value as any)}
              className="h-9 w-full rounded-xl border border-[var(--glass-border)] bg-[var(--glass-bg)] px-3 text-sm"
            >
              <option value="single">Single student</option>
              <option value="class">Per class</option>
              <option value="all">All students</option>
            </select>
          </div>

          {scope === "single" ? (
            <div className="lg:col-span-1">
              <p className="text-xs font-medium text-foreground mb-1">Student</p>
              <select
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
                className="h-9 w-full rounded-xl border border-[var(--glass-border)] bg-[var(--glass-bg)] px-3 text-sm"
              >
                <option value="">Select student…</option>
                {students.map((s: any) => (
                  <option key={String(s.id)} value={String(s.id)}>
                    {s.name} ({s.id})
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          {scope === "class" ? (
            <div className="lg:col-span-1">
              <p className="text-xs font-medium text-foreground mb-1">Class</p>
              <select
                value={classId}
                onChange={(e) => setClassId(e.target.value)}
                className="h-9 w-full rounded-xl border border-[var(--glass-border)] bg-[var(--glass-bg)] px-3 text-sm"
              >
                <option value="">Select class…</option>
                {classes.map((c: any) => (
                  <option key={String(c.id)} value={String(c.id)}>
                    {c.name} ({c.id})
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          <div className="lg:col-span-1">
            <p className="text-xs font-medium text-foreground mb-1">Title</p>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="h-9 w-full rounded-xl border border-[var(--glass-border)] bg-[var(--glass-bg)] px-3 text-sm"
            />
          </div>
          <div className="lg:col-span-1">
            <p className="text-xs font-medium text-foreground mb-1">Due date</p>
            <input
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              type="date"
              className="h-9 w-full rounded-xl border border-[var(--glass-border)] bg-[var(--glass-bg)] px-3 text-sm"
            />
          </div>
          <div className="lg:col-span-1">
            <p className="text-xs font-medium text-foreground mb-1">Fee rule</p>
            <div className="h-9 w-full rounded-xl border border-[var(--glass-border)] bg-[var(--glass-bg)] px-3 text-sm flex items-center text-foreground/80">
              1 course = {COURSE_FEE.toLocaleString()}
            </div>
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between gap-3 flex-wrap">
          <Badge variant="outline" className="bg-transparent flex items-center gap-2">
            <Users className="w-3.5 h-3.5" />
            Targets: {targets.length} · Enrolled: {payableTargets.length} · Total: {estimatedTotalAmount.toLocaleString()}
          </Badge>
          <Button
            onClick={createInvoice}
            disabled={
              !title.trim() ||
              !dueDate ||
              (scope === "single" && !studentId) ||
              (scope === "class" && !classId) ||
              payableTargets.length === 0
            }
            className="rounded-xl"
          >
            Create invoice{payableTargets.length > 1 ? "s" : ""}
          </Button>
        </div>
      </Card>

      <Card variant="glass" className="p-5">
        <p className="text-sm font-semibold text-foreground">Invoices</p>
        {sorted.length === 0 ? (
          <p className="text-sm text-foreground/60 mt-3">No invoices yet.</p>
        ) : (
          <div className="mt-3 space-y-2">
            {sorted.slice(0, 50).map((i) => (
              <div key={i.id} className="rounded-xl border border-[var(--glass-border)] bg-[var(--glass-bg)] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-foreground truncate">{i.title}</p>
                      <Badge variant={i.status === "paid" ? "default" : "outline"} className="bg-transparent">
                        {i.status === "paid" ? "PAID" : i.status === "partial" ? "PARTIAL" : "UNPAID"}
                      </Badge>
                    </div>
                    <p className="text-xs text-foreground/60 mt-1">
                      Student: <span className="text-foreground">{i.studentName}</span> ({i.studentId})
                    </p>
                    <p className="text-xs text-foreground/60">
                      Total: <span className="text-foreground font-medium">{i.totalAmount}</span> · Paid:{" "}
                      <span className="text-foreground font-medium">{i.amountPaid}</span> · Balance:{" "}
                      <span className="text-foreground font-medium">{i.balance}</span> · Due: {i.dueDate}
                    </p>
                    {i.payments.length ? (
                      <p className="text-[10px] text-foreground/50 mt-1">
                        Last payment: {new Date(i.payments[i.payments.length - 1].paidAt).toLocaleString()}
                      </p>
                    ) : null}
                    {(i.paymentSubmissions || []).some((s) => s.status === "pending") ? (
                      <p className="text-[10px] text-amber-600 mt-1">
                        Payment slip submitted and waiting for verification.
                      </p>
                    ) : null}
                  </div>

                  <div className="flex items-center gap-1 flex-wrap justify-end">
                    {(i.paymentSubmissions || [])
                      .filter((s) => s.status === "pending")
                      .slice(0, 1)
                      .map((s) => (
                        <div key={s.id} className="flex items-center gap-1">
                          <Button size="sm" variant="outline" className="rounded-xl" onClick={() => window.open(s.slipDataUrl, "_blank")}>
                            View slip
                          </Button>
                          <Button
                            size="sm"
                            className="rounded-xl"
                            onClick={() => verifySubmissionAndMarkPaid(i.id, s.id)}
                          >
                            Verify & mark paid
                          </Button>
                        </div>
                      ))}
                    {i.status !== "paid" ? (
                      <Button size="sm" variant="outline" className="rounded-xl" onClick={() => markPaid(i.id)}>
                        <CheckCircle2 className="w-4 h-4" />
                        Mark paid
                      </Button>
                    ) : (
                      <div className="flex items-center gap-2 text-xs text-foreground/60">
                        <Clock className="w-4 h-4" />
                        Settled
                      </div>
                    )}
                    <Button size="icon" variant="ghost" className="rounded-xl" onClick={() => remove(i.id)} aria-label="Delete invoice">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}

