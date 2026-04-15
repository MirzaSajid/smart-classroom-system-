"use client"

import type React from "react"

import { Button } from "@/components/ui/button"
import { BarChart3, Users, Shield, User, LogOut } from "lucide-react"

type UserRole = "admin" | "teacher" | "security" | "student"

interface NavigationProps {
  currentRole: UserRole
  onRoleChange: (role: UserRole) => void
  onLogout?: () => void
}

export function Navigation({ currentRole, onRoleChange, onLogout }: NavigationProps) {
  const roles: { id: UserRole; label: string; icon: React.ReactNode }[] = [
    { id: "admin", label: "Admin", icon: <BarChart3 className="w-5 h-5" /> },
    { id: "teacher", label: "Teacher", icon: <Users className="w-5 h-5" /> },
    { id: "security", label: "Security", icon: <Shield className="w-5 h-5" /> },
    { id: "student", label: "Student", icon: <User className="w-5 h-5" /> },
  ]

  return (
    <div className="w-64 border-r border-border bg-sidebar p-6 flex flex-col">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-sidebar-primary">SmartClass</h1>
        <p className="text-sm text-sidebar-foreground/60">Campus Intelligence</p>
      </div>

      <nav className="flex-1 space-y-2">
        {roles.map((role) => {
          // Students can only see their own portal, not admin/teacher/security dashboards
          if (currentRole === "student" && role.id !== "student") {
            return null
          }
          
          // Admin/teacher/security users cannot see student portal
          if ((currentRole === "admin" || currentRole === "teacher" || currentRole === "security") && role.id === "student") {
            return null
          }
          
          // Admin/teacher/security users can see all other dashboards
          return (
            <Button
              key={role.id}
              variant={currentRole === role.id ? "default" : "ghost"}
              className="w-full justify-start gap-3"
              onClick={() => {
                // Prevent students from switching to other roles
                if (currentRole === "student" && role.id !== "student") {
                  return
                }
                onRoleChange(role.id)
              }}
            >
              {role.icon}
              {role.label}
            </Button>
          )
        })}
      </nav>

      <Button variant="outline" className="w-full justify-start gap-3 bg-transparent" onClick={onLogout}>
        <LogOut className="w-5 h-5" />
        Logout
      </Button>
    </div>
  )
}
