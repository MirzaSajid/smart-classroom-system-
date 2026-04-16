"use client"

import { useState } from "react"
import { Navigation } from "@/components/navigation"
import { AdminDashboard } from "@/components/dashboards/admin-dashboard"
import { TeacherPortal } from "@/components/dashboards/teacher-portal"
import { SecurityDashboard } from "@/components/dashboards/security-dashboard"
import { StudentPortal } from "@/components/dashboards/student-portal"
import { LoginPage } from "@/components/login-page"
import { LocalStorageSync } from "@/components/persistence/local-storage-sync"

type UserRole = "admin" | "teacher" | "security" | "student"

export default function Home() {
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [currentRole, setCurrentRole] = useState<UserRole>("admin")

  const handleLogin = (role: UserRole) => {
    setCurrentRole(role)
    setIsLoggedIn(true)
    // Store login time for session management
    localStorage.setItem('loginTime', new Date().toISOString())
  }

  const handleLogout = () => {
    setIsLoggedIn(false)
    setCurrentRole("admin")
    localStorage.removeItem('currentUser')
    localStorage.removeItem('loginTime')
  }

  const renderDashboard = () => {
    switch (currentRole) {
      case "admin":
        return <AdminDashboard />
      case "teacher":
        return <TeacherPortal />
      case "security":
        return <SecurityDashboard />
      case "student":
        return <StudentPortal />
      default:
        return <AdminDashboard />
    }
  }

  if (!isLoggedIn) {
    return (
      <>
        <LocalStorageSync />
        <LoginPage onLogin={handleLogin} />
      </>
    )
  }

  return (
    <>
      <LocalStorageSync />
      <div className="flex h-screen bg-background">
        <Navigation currentRole={currentRole} onRoleChange={setCurrentRole} onLogout={handleLogout} />
        <main className="flex-1 overflow-auto">{renderDashboard()}</main>
      </div>
    </>
  )
}
