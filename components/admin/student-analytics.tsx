'use client'

import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Search, Download, TrendingUp, AlertCircle, CheckCircle } from 'lucide-react'

export function StudentAnalytics() {
  const [selectedStudent, setSelectedStudent] = useState<any>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [students, setStudents] = useState<any[]>([])
  const [attendanceRecords, setAttendanceRecords] = useState<any[]>([])

  useEffect(() => {
    const adminData = localStorage.getItem('adminData')
    const records = localStorage.getItem('attendanceRecords')
    
    if (adminData) {
      try {
        const data = JSON.parse(adminData)
        setStudents(data.students || [])
      } catch (e) {
        console.error('[v0] Failed to load students:', e)
      }
    }

    if (records) {
      try {
        setAttendanceRecords(JSON.parse(records))
      } catch (e) {
        console.error('[v0] Failed to load attendance:', e)
      }
    }
  }, [])

  const filteredStudents = students.filter(student =>
    student.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    student.rollNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
    student.id.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const getStudentAttendance = (studentId: string) => {
    const records = attendanceRecords.filter(r => r.studentId === studentId)
    const today = new Date().toISOString().split('T')[0]
    const thisMonth = new Date().toISOString().slice(0, 7)
    
    const todayPresent = records.some(r => r.date === today)
    const thisMonthCount = records.filter(r => r.date.startsWith(thisMonth)).length
    const totalDays = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate()
    const attendancePercentage = Math.round((thisMonthCount / totalDays) * 100)

    return { todayPresent, thisMonthCount, attendancePercentage, totalRecords: records.length }
  }

  const exportStudentData = () => {
    const data = selectedStudent ? [selectedStudent] : students
    const csv = [
      ['ID', 'Name', 'Roll Number', 'Class ID', 'Parent Contact', 'Attendance %', 'Status'],
      ...data.map(s => {
        const att = getStudentAttendance(s.id)
        return [s.id, s.name, s.rollNumber, s.classId, s.parentContact, att.attendancePercentage + '%', att.todayPresent ? 'Present' : 'Absent']
      })
    ]
    
    const csvContent = csv.map(row => row.map(cell => `"${cell}"`).join(',')).join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `students-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
  }

  return (
    <div className="space-y-6">
      {/* Search and Filter */}
      <Card className="p-6">
        <div className="flex gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-3 w-4 h-4 text-foreground/40" />
            <Input
              placeholder="Search by name, roll number, or ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Button onClick={exportStudentData} variant="outline" className="gap-2">
            <Download className="w-4 h-4" />
            Export
          </Button>
        </div>
      </Card>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Students List */}
        <div className="lg:col-span-1">
          <Card className="p-6 max-h-screen overflow-y-auto">
            <h3 className="text-lg font-semibold text-foreground mb-4">Students ({filteredStudents.length})</h3>
            <div className="space-y-2">
              {filteredStudents.length === 0 ? (
                <p className="text-foreground/60 text-sm">No students found</p>
              ) : (
                filteredStudents.map(student => {
                  const att = getStudentAttendance(student.id)
                  return (
                    <div
                      key={student.id}
                      onClick={() => setSelectedStudent(student)}
                      className={`p-3 rounded-lg border cursor-pointer transition-all ${
                        selectedStudent?.id === student.id
                          ? 'border-primary bg-primary/10'
                          : 'border-border hover:border-primary/50'
                      }`}
                    >
                      <p className="font-semibold text-sm text-foreground">{student.name}</p>
                      <p className="text-xs text-foreground/60">{student.rollNumber}</p>
                      <div className="flex items-center gap-2 mt-2">
                        {att.todayPresent ? (
                          <Badge className="bg-primary/20 text-primary text-xs">Present Today</Badge>
                        ) : (
                          <Badge className="bg-destructive/20 text-destructive text-xs">Absent Today</Badge>
                        )}
                        <span className="text-xs text-foreground/60">{att.attendancePercentage}%</span>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </Card>
        </div>

        {/* Student Details */}
        <div className="lg:col-span-2">
          {selectedStudent ? (
            <div className="space-y-6">
              {/* Profile Card */}
              <Card className="p-6">
                <h3 className="text-2xl font-bold text-foreground mb-4">{selectedStudent.name}</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-foreground/60">Student ID</p>
                    <p className="font-semibold text-foreground">{selectedStudent.id}</p>
                  </div>
                  <div>
                    <p className="text-sm text-foreground/60">Roll Number</p>
                    <p className="font-semibold text-foreground">{selectedStudent.rollNumber}</p>
                  </div>
                  <div>
                    <p className="text-sm text-foreground/60">Class ID</p>
                    <p className="font-semibold text-foreground">{selectedStudent.classId}</p>
                  </div>
                  <div>
                    <p className="text-sm text-foreground/60">Parent Contact</p>
                    <p className="font-semibold text-foreground">{selectedStudent.parentContact || 'N/A'}</p>
                  </div>
                </div>
              </Card>

              {/* Attendance Card */}
              <Card className="p-6">
                <h4 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                  <CheckCircle className="w-5 h-5" />
                  Attendance Record
                </h4>
                {(() => {
                  const att = getStudentAttendance(selectedStudent.id)
                  return (
                    <div className="space-y-4">
                      <div className="grid grid-cols-3 gap-4">
                        <div className="bg-primary/10 rounded-lg p-4 text-center">
                          <p className="text-2xl font-bold text-primary">{att.attendancePercentage}%</p>
                          <p className="text-xs text-foreground/60 mt-1">This Month</p>
                        </div>
                        <div className="bg-accent/10 rounded-lg p-4 text-center">
                          <p className="text-2xl font-bold text-accent">{att.thisMonthCount}</p>
                          <p className="text-xs text-foreground/60 mt-1">Days Present</p>
                        </div>
                        <div className={`rounded-lg p-4 text-center ${att.todayPresent ? 'bg-primary/10' : 'bg-destructive/10'}`}>
                          <p className={`text-lg font-bold ${att.todayPresent ? 'text-primary' : 'text-destructive'}`}>
                            {att.todayPresent ? 'Present' : 'Absent'}
                          </p>
                          <p className="text-xs text-foreground/60 mt-1">Today</p>
                        </div>
                      </div>
                      <div className="bg-background rounded-lg p-4 border border-border">
                        <p className="text-sm text-foreground/60">Total Attendance Records: {att.totalRecords}</p>
                      </div>
                    </div>
                  )
                })()}
              </Card>

              {/* Academic Performance Card */}
              <Card className="p-6">
                <h4 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                  <TrendingUp className="w-5 h-5" />
                  Academic Performance
                </h4>
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-semibold text-foreground">Class Participation</span>
                      <span className="text-sm text-foreground/60">78%</span>
                    </div>
                    <div className="w-full bg-background rounded-full h-2 border border-border">
                      <div className="bg-primary h-full rounded-full" style={{ width: '78%' }} />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-semibold text-foreground">Assignment Completion</span>
                      <span className="text-sm text-foreground/60">95%</span>
                    </div>
                    <div className="w-full bg-background rounded-full h-2 border border-border">
                      <div className="bg-accent h-full rounded-full" style={{ width: '95%' }} />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-4 mt-6 pt-4 border-t border-border">
                    <div className="text-center">
                      <p className="text-2xl font-bold text-foreground">3.8</p>
                      <p className="text-xs text-foreground/60">CGPA</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-primary">A+</p>
                      <p className="text-xs text-foreground/60">Grade</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-accent">95</p>
                      <p className="text-xs text-foreground/60">GPA</p>
                    </div>
                  </div>
                </div>
              </Card>

              {/* Behavior & Alerts */}
              <Card className="p-6">
                <h4 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                  <AlertCircle className="w-5 h-5" />
                  Behavior & Alerts
                </h4>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-background rounded border border-border">
                    <span className="text-sm text-foreground">Disciplinary Records</span>
                    <Badge variant="outline">0</Badge>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-background rounded border border-border">
                    <span className="text-sm text-foreground">Behavior Alerts</span>
                    <Badge variant="outline">0</Badge>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-background rounded border border-border">
                    <span className="text-sm text-foreground">Last Alert</span>
                    <Badge variant="outline">Never</Badge>
                  </div>
                </div>
              </Card>
            </div>
          ) : (
            <Card className="p-12 text-center">
              <p className="text-foreground/60">Select a student to view detailed analytics</p>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
