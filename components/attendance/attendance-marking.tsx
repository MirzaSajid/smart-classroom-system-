"use client"

import { useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Check, X, Search, Clock, Users } from "lucide-react"

interface Student {
  id: string
  name: string
  status: "present" | "absent" | "late" | "unmarked"
}

interface AttendanceMarkingProps {
  students: Student[]
  onStatusChange: (studentId: string, status: "present" | "absent" | "late") => void
  sessionActive: boolean
  timeRemaining: number
}

export function AttendanceMarking({ students, onStatusChange, sessionActive, timeRemaining }: AttendanceMarkingProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [filterStatus, setFilterStatus] = useState<"all" | "unmarked" | "marked">("all")

  const filteredStudents = students.filter((student) => {
    const matchesSearch =
      student.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      student.id.toLowerCase().includes(searchQuery.toLowerCase())

    const matchesFilter =
      filterStatus === "all" ||
      (filterStatus === "unmarked" && student.status === "unmarked") ||
      (filterStatus === "marked" && student.status !== "unmarked")

    return matchesSearch && matchesFilter
  })

  const stats = {
    present: students.filter((s) => s.status === "present").length,
    absent: students.filter((s) => s.status === "absent").length,
    late: students.filter((s) => s.status === "late").length,
    unmarked: students.filter((s) => s.status === "unmarked").length,
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "present":
        return "bg-primary/10 text-primary border-primary/20"
      case "absent":
        return "bg-destructive/10 text-destructive border-destructive/20"
      case "late":
        return "bg-accent/10 text-accent border-accent/20"
      default:
        return "bg-muted/10 text-muted-foreground border-muted/20"
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "present":
        return <Check className="w-4 h-4" />
      case "absent":
        return <X className="w-4 h-4" />
      case "late":
        return <Clock className="w-4 h-4" />
      default:
        return <Users className="w-4 h-4" />
    }
  }

  return (
    <div className="space-y-6">
      {/* Statistics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-4 text-center">
          <p className="text-2xl font-bold text-primary">{stats.present}</p>
          <p className="text-xs text-foreground/60">Present</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-2xl font-bold text-destructive">{stats.absent}</p>
          <p className="text-xs text-foreground/60">Absent</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-2xl font-bold text-accent">{stats.late}</p>
          <p className="text-xs text-foreground/60">Late</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-2xl font-bold text-foreground/50">{stats.unmarked}</p>
          <p className="text-xs text-foreground/60">Unmarked</p>
        </Card>
      </div>

      {/* Search and Filter */}
      <Card className="p-4">
        <div className="space-y-3">
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <Search className="w-4 h-4 absolute left-3 top-3 text-foreground/50" />
              <Input
                placeholder="Search student name or ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={() => setFilterStatus("all")}
              variant={filterStatus === "all" ? "default" : "outline"}
              size="sm"
            >
              All
            </Button>
            <Button
              onClick={() => setFilterStatus("marked")}
              variant={filterStatus === "marked" ? "default" : "outline"}
              size="sm"
            >
              Marked
            </Button>
            <Button
              onClick={() => setFilterStatus("unmarked")}
              variant={filterStatus === "unmarked" ? "default" : "outline"}
              size="sm"
            >
              Unmarked
            </Button>
          </div>
        </div>
      </Card>

      {/* Students List */}
      <Card className="p-4">
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {filteredStudents.length === 0 ? (
            <p className="text-center text-foreground/60 py-8">No students found</p>
          ) : (
            filteredStudents.map((student) => (
              <div
                key={student.id}
                className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-card/50 transition-colors"
              >
                <div className="flex-1">
                  <p className="font-medium text-foreground text-sm">{student.name}</p>
                  <p className="text-xs text-foreground/50">{student.id}</p>
                </div>

                {/* Status Display */}
                <div className="flex items-center gap-2 mr-4">
                  <Badge className={`${getStatusColor(student.status)} border flex items-center gap-1`}>
                    {getStatusIcon(student.status)}
                    {student.status === "unmarked"
                      ? "—"
                      : student.status.charAt(0).toUpperCase() + student.status.slice(1)}
                  </Badge>
                </div>

                <div className="flex gap-1">
                  <Button
                    onClick={() => onStatusChange(student.id, "present")}
                    variant={student.status === "present" ? "default" : "outline"}
                    size="sm"
                    className="w-10 h-10 p-0"
                    disabled={!sessionActive}
                    title="Mark Present"
                  >
                    <Check className="w-4 h-4" />
                  </Button>
                  <Button
                    onClick={() => onStatusChange(student.id, "late")}
                    variant={student.status === "late" ? "default" : "outline"}
                    size="sm"
                    className="w-10 h-10 p-0"
                    disabled={!sessionActive}
                    title="Mark Late"
                  >
                    <Clock className="w-4 h-4" />
                  </Button>
                  <Button
                    onClick={() => onStatusChange(student.id, "absent")}
                    variant={student.status === "absent" ? "default" : "outline"}
                    size="sm"
                    className="w-10 h-10 p-0"
                    disabled={!sessionActive}
                    title="Mark Absent"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </Card>

      {/* Time Warning */}
      {timeRemaining < 60 && timeRemaining > 0 && (
        <div className="bg-accent/10 border border-accent/20 rounded-lg p-3 text-sm text-accent">
          ⏰ Less than 1 minute remaining to mark attendance
        </div>
      )}
    </div>
  )
}
