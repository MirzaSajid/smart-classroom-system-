"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Shield, GraduationCap, Eye, EyeOff, Lock, User, Building2 } from "lucide-react"

type LoginRole = "admin" | "student"

interface LoginPageProps {
  onLogin: (role: "admin" | "teacher" | "security" | "student") => void
}

export function LoginPage({ onLogin }: LoginPageProps) {
  const [selectedRole, setSelectedRole] = useState<LoginRole | null>(null)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setIsLoading(true)

    // Simulate authentication delay
    await new Promise((resolve) => setTimeout(resolve, 1000))

    // Demo credentials check
    if (selectedRole === "admin") {
      if (email === "admin@campus.edu" && password === "admin123") {
        localStorage.setItem('currentUser', JSON.stringify({ role: 'admin', email }))
        onLogin("admin")
      } else {
        setError("Invalid admin credentials. Try: admin@campus.edu / admin123")
      }
    } else if (selectedRole === "student") {
      // Authenticate against student data in localStorage
      const adminData = localStorage.getItem('adminData')
      if (adminData) {
        const parsed = JSON.parse(adminData)
        const student = parsed.students?.find((s: any) => s.email === email && s.password === password)
        
        if (student) {
          localStorage.setItem('currentUser', JSON.stringify({ role: 'student', email, studentId: student.id, name: student.name }))
          onLogin("student")
        } else {
          setError("Invalid student credentials. Check your email and password.")
        }
      } else {
        setError("No students registered in the system.")
      }
    }

    setIsLoading(false)
  }

  const handleBack = () => {
    setSelectedRole(null)
    setEmail("")
    setPassword("")
    setError("")
  }

  // Role selection screen
  if (!selectedRole) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 p-4">
        <div className="w-full max-w-md space-y-8">
          {/* Logo and Title */}
          <div className="text-center space-y-2">
            <div className="flex justify-center">
              <div className="h-16 w-16 rounded-xl bg-primary/10 flex items-center justify-center">
                <Building2 className="h-8 w-8 text-primary" />
              </div>
            </div>
            <h1 className="text-3xl font-bold text-foreground">Smart Campus</h1>
            <p className="text-muted-foreground">Attendance, Monitoring & Security System</p>
          </div>

          {/* Admin Login Card */}
          <div className="space-y-4">
            <p className="text-center text-sm text-muted-foreground">Administrator Access</p>

            <Card
              className="cursor-pointer transition-all hover:border-primary hover:shadow-lg group"
              onClick={() => setSelectedRole("admin")}
            >
              <CardContent className="flex items-center gap-4 p-6">
                <div className="h-14 w-14 rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                  <Shield className="h-7 w-7 text-primary" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-lg text-foreground">Administrator Login</h3>
                  <p className="text-sm text-muted-foreground">
                    Manage campus operations and security
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Divider */}
          <div className="flex items-center gap-4">
            <div className="flex-1 h-px bg-border"></div>
            <span className="text-xs text-muted-foreground">OR</span>
            <div className="flex-1 h-px bg-border"></div>
          </div>

          {/* Student Login Link */}
          <div className="space-y-4">
            <p className="text-center text-sm text-muted-foreground">Are you a student?</p>
            <Button
              onClick={() => setSelectedRole("student")}
              variant="outline"
              className="w-full h-auto py-4 px-4 bg-accent/5 hover:bg-accent/10"
            >
              <div className="flex items-center gap-3 w-full">
                <div className="h-10 w-10 rounded-lg bg-accent/10 flex items-center justify-center">
                  <GraduationCap className="h-5 w-5 text-accent" />
                </div>
                <div className="text-left flex-1">
                  <p className="font-semibold text-foreground">Student Login</p>
                  <p className="text-xs text-muted-foreground">Access your portal</p>
                </div>
              </div>
            </Button>
          </div>

          {/* Footer */}
          <p className="text-center text-xs text-muted-foreground">Protected by AI-powered security monitoring</p>
        </div>
      </div>
    )
  }

  // Login form screen
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="flex justify-center">
            <div
              className={`h-16 w-16 rounded-xl flex items-center justify-center ${
                selectedRole === "admin" ? "bg-primary/10" : "bg-accent/10"
              }`}
            >
              {selectedRole === "admin" ? (
                <Shield className="h-8 w-8 text-primary" />
              ) : (
                <GraduationCap className="h-8 w-8 text-accent" />
              )}
            </div>
          </div>
          <h1 className="text-2xl font-bold text-foreground">
            {selectedRole === "admin" ? "Admin Login" : "Student Login"}
          </h1>
          <p className="text-muted-foreground text-sm">Enter your credentials to access the dashboard</p>
        </div>

        {/* Login Form */}
        <Card>
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="text-xl">Sign In</CardTitle>
            <CardDescription>
              {selectedRole === "admin"
                ? "Access administrative controls and monitoring"
                : "View your attendance and class information"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder={selectedRole === "admin" ? "admin@campus.edu" : "student@campus.edu"}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10 pr-10"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {error && <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">{error}</div>}

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? "Signing in..." : "Sign In"}
              </Button>

              <Button type="button" variant="ghost" className="w-full" onClick={handleBack}>
                Back to role selection
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Demo Credentials */}
        <Card className="bg-muted/50 border-dashed">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground text-center mb-2">Demo Credentials</p>
            <div className="text-xs text-center space-y-1">
              {selectedRole === "admin" ? (
                <p>
                  <span className="font-medium">Admin:</span> admin@campus.edu / admin123
                </p>
              ) : (
                <div className="space-y-2">
                  <p>
                    <span className="font-medium">Students:</span> Use email and password<br />
                    <span className="text-muted-foreground">added by admin</span>
                  </p>
                  <p className="text-muted-foreground">
                    <span className="font-medium">Default Password:</span> student123
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
