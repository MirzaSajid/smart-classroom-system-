"use client"

import type React from "react"
import { useMemo } from "react"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { BarChart3, Users, Shield, User, LogOut, LineChart, Receipt } from "lucide-react"

type UserRole = "admin" | "teacher" | "security" | "student"
type StudentSection = "overview" | "academic" | "fees"

interface NavigationProps {
  currentRole: UserRole
  onRoleChange: (role: UserRole) => void
  onLogout?: () => void
  activeStudentSection?: StudentSection
  onStudentSectionChange?: (section: StudentSection) => void
}

export function Navigation({
  currentRole,
  onRoleChange,
  onLogout,
  activeStudentSection = "overview",
  onStudentSectionChange,
}: NavigationProps) {
  const signedInRole = useMemo(() => {
    try {
      const userRaw = localStorage.getItem("currentUser")
      if (!userRaw) return currentRole
      const parsed = JSON.parse(userRaw)
      return (parsed?.role as UserRole) || currentRole
    } catch {
      return currentRole
    }
  }, [currentRole])

  const signedInUser = useMemo(() => {
    try {
      const userRaw = localStorage.getItem("currentUser")
      if (!userRaw) return null
      const parsed = JSON.parse(userRaw) as { email?: string; name?: string; role?: UserRole } | null
      if (!parsed) return null
      return {
        email: typeof parsed.email === "string" ? parsed.email : "",
        name: typeof parsed.name === "string" ? parsed.name : "",
        role: (parsed.role as UserRole) || signedInRole,
      }
    } catch {
      return null
    }
  }, [signedInRole])

  const roles: { id: UserRole; label: string; icon: React.ReactNode }[] = [
    { id: "admin", label: "Admin", icon: <BarChart3 className="w-5 h-5" /> },
    { id: "teacher", label: "Teacher", icon: <Users className="w-5 h-5" /> },
    { id: "security", label: "Security", icon: <Shield className="w-5 h-5" /> },
    { id: "student", label: "Student", icon: <User className="w-5 h-5" /> },
  ]

  return (
    <aside className="w-[280px] shrink-0 border-r border-border/60 bg-[var(--glass-bg)] backdrop-blur-2xl supports-[backdrop-filter]:bg-[var(--glass-bg)]">
      <div className="h-svh p-4 flex flex-col">
        <div className="rounded-2xl border border-[var(--glass-border)] bg-[var(--glass-bg-strong)] backdrop-blur-2xl shadow-sm p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-lg font-semibold tracking-tight text-sidebar-primary">SmartClass</h1>
              <p className="text-xs text-sidebar-foreground/70">Campus Intelligence</p>
            </div>
            <Badge variant="outline" className="bg-transparent">
              {signedInRole}
            </Badge>
          </div>
          {signedInUser?.email || signedInUser?.name ? (
            <div className="mt-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground truncate">
                  {signedInUser?.name || signedInUser?.email || "Signed in"}
                </p>
                {signedInUser?.name && signedInUser?.email ? (
                  <p className="text-xs text-foreground/60 truncate">{signedInUser.email}</p>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>

        <div className="mt-4 flex-1 overflow-auto">
          <nav className="space-y-1">
            {roles.map((role) => {
              // Admins stay on admin tooling; no direct student/teacher portal switching from the shell.
              if (signedInRole === "admin" && (role.id === "teacher" || role.id === "student")) {
                return null
              }

              // Non-admin users can only access their own portal.
              if (signedInRole !== "admin" && role.id !== signedInRole) {
                return null
              }

              const active = currentRole === role.id
              return (
                <Button
                  key={role.id}
                  variant={active ? "default" : "ghost"}
                  className={
                    "w-full justify-start gap-3 rounded-xl transition-all " +
                    (active
                      ? "shadow-sm"
                      : "hover:bg-[var(--glass-bg-strong)] hover:backdrop-blur-xl hover:border hover:border-[var(--glass-border)]")
                  }
                  onClick={() => {
                    if (signedInRole !== "admin" && role.id !== signedInRole) {
                      return
                    }
                    if (role.id === "student") onStudentSectionChange?.("overview")
                    onRoleChange(role.id)
                  }}
                >
                  {role.icon}
                  {role.label}
                </Button>
              )
            })}

            {signedInRole === "student" && currentRole === "student" ? (
              <div className="pt-2">
                <p className="px-3 py-2 text-[11px] font-semibold text-foreground/60 tracking-wide">Student</p>
                <Button
                  type="button"
                  variant={activeStudentSection === "academic" ? "default" : "ghost"}
                  className="w-full justify-start gap-3 rounded-xl hover:bg-[var(--glass-bg-strong)] hover:backdrop-blur-xl hover:border hover:border-[var(--glass-border)]"
                  onClick={() => {
                    onStudentSectionChange?.("academic")
                  }}
                >
                  <LineChart className="w-5 h-5" />
                  Academic performance
                </Button>
                <Button
                  type="button"
                  variant={activeStudentSection === "fees" ? "default" : "ghost"}
                  className="w-full justify-start gap-3 rounded-xl hover:bg-[var(--glass-bg-strong)] hover:backdrop-blur-xl hover:border hover:border-[var(--glass-border)]"
                  onClick={() => {
                    onStudentSectionChange?.("fees")
                  }}
                >
                  <Receipt className="w-5 h-5" />
                  Fees & invoices
                </Button>
              </div>
            ) : null}
          </nav>
        </div>

        <div className="pt-3">
          <Button
            variant="outline"
            className="w-full justify-start gap-3 rounded-xl bg-[var(--glass-bg)] border-[var(--glass-border)] backdrop-blur-2xl hover:bg-[var(--glass-bg-strong)]"
            onClick={onLogout}
          >
            <LogOut className="w-5 h-5" />
            Logout
          </Button>
        </div>
      </div>
    </aside>
  )
}
