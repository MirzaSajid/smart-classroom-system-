'use client'

import { useState, useEffect } from 'react'
import { Download, FileText, Calendar, Trash2 } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

interface AttendanceRecord {
  studentId: string
  studentName: string
  timestamp: string
  confidence: number
  date: string
  time: string
}

export function AttendanceExport() {
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([])
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0])

  // Load attendance from localStorage
  useEffect(() => {
    const stored = localStorage.getItem('attendanceRecords')
    if (stored) {
      try {
        setAttendance(JSON.parse(stored))
      } catch (e) {
        console.error('[v0] Failed to load attendance:', e)
      }
    }
  }, [])

  const filteredAttendance = attendance.filter((record) => record.date === selectedDate)

  const exportToCSV = () => {
    const headers = ['Student ID', 'Student Name', 'Date', 'Time', 'Confidence', 'Timestamp']
    const rows = filteredAttendance.map((record) => [
      record.studentId,
      record.studentName,
      record.date,
      record.time,
      (record.confidence * 100).toFixed(1) + '%',
      record.timestamp,
    ])

    // Create CSV content
    let csvContent = 'data:text/csv;charset=utf-8,'
    csvContent += headers.join(',') + '\n'
    csvContent += rows.map((row) => row.map((cell) => `"${cell}"`).join(',')).join('\n')

    // Download CSV
    const link = document.createElement('a')
    link.setAttribute('href', encodeURI(csvContent))
    link.setAttribute('download', `attendance-${selectedDate}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const exportToExcel = () => {
    // Create HTML table that Excel can parse
    let excelContent = `
      <html>
        <head>
          <meta charset="UTF-8">
          <style>
            table { border-collapse: collapse; width: 100%; }
            th, td { border: 1px solid black; padding: 8px; text-align: left; }
            th { background-color: #4CAF50; color: white; font-weight: bold; }
          </style>
        </head>
        <body>
          <table>
            <tr>
              <th>Student ID</th>
              <th>Student Name</th>
              <th>Date</th>
              <th>Time</th>
              <th>Confidence</th>
              <th>Timestamp</th>
            </tr>
    `

    filteredAttendance.forEach((record) => {
      excelContent += `
        <tr>
          <td>${record.studentId}</td>
          <td>${record.studentName}</td>
          <td>${record.date}</td>
          <td>${record.time}</td>
          <td>${(record.confidence * 100).toFixed(1)}%</td>
          <td>${record.timestamp}</td>
        </tr>
      `
    })

    excelContent += `
          </table>
        </body>
      </html>
    `

    const blob = new Blob([excelContent], { type: 'application/vnd.ms-excel' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `attendance-${selectedDate}.xls`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const clearAttendance = () => {
    if (confirm('Are you sure you want to clear all attendance records? This cannot be undone.')) {
      localStorage.setItem('attendanceRecords', JSON.stringify([]))
      setAttendance([])
    }
  }

  const printReport = () => {
    const printWindow = window.open('', '', 'height=600,width=800')
    if (!printWindow) return

    let printContent = `
      <html>
        <head>
          <title>Attendance Report - ${selectedDate}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            h1 { color: #333; }
            table { border-collapse: collapse; width: 100%; margin-top: 20px; }
            th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
            th { background-color: #4CAF50; color: white; }
            tr:nth-child(even) { background-color: #f2f2f2; }
          </style>
        </head>
        <body>
          <h1>Attendance Report</h1>
          <p>Date: ${selectedDate}</p>
          <p>Total Present: ${filteredAttendance.length}</p>
          <table>
            <tr>
              <th>Student ID</th>
              <th>Student Name</th>
              <th>Time</th>
              <th>Confidence</th>
            </tr>
    `

    filteredAttendance.forEach((record) => {
      printContent += `
        <tr>
          <td>${record.studentId}</td>
          <td>${record.studentName}</td>
          <td>${record.time}</td>
          <td>${(record.confidence * 100).toFixed(1)}%</td>
        </tr>
      `
    })

    printContent += `
          </table>
        </body>
      </html>
    `

    printWindow.document.write(printContent)
    printWindow.document.close()
    printWindow.print()
  }

  return (
    <Card className="p-6 space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <FileText className="w-5 h-5 text-primary" />
        <h3 className="text-lg font-semibold text-foreground">Attendance Export</h3>
      </div>

      {/* Date Selection */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground/80">Select Date</label>
        <input
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground"
        />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-2 bg-accent/10 p-3 rounded-lg">
        <div>
          <div className="text-xs text-foreground/60">Present Today</div>
          <div className="text-2xl font-bold text-primary">{filteredAttendance.length}</div>
        </div>
        <div>
          <div className="text-xs text-foreground/60">Avg Confidence</div>
          <div className="text-2xl font-bold text-primary">
            {filteredAttendance.length > 0
              ? (
                  (filteredAttendance.reduce((sum, r) => sum + r.confidence, 0) /
                    filteredAttendance.length) *
                  100
                ).toFixed(1)
              : 0}
            %
          </div>
        </div>
      </div>

      {/* Export Buttons */}
      <div className="grid grid-cols-4 gap-2 pt-4 border-t border-border">
        <Button
          onClick={exportToCSV}
          disabled={filteredAttendance.length === 0}
          variant="outline"
          className="flex-1 text-xs"
        >
          <Download className="w-4 h-4 mr-1" />
          CSV
        </Button>
        <Button
          onClick={exportToExcel}
          disabled={filteredAttendance.length === 0}
          variant="outline"
          className="flex-1 text-xs"
        >
          <Download className="w-4 h-4 mr-1" />
          Excel
        </Button>
        <Button
          onClick={printReport}
          disabled={filteredAttendance.length === 0}
          variant="outline"
          className="flex-1 text-xs"
        >
          <Calendar className="w-4 h-4 mr-1" />
          Print
        </Button>
        <Button
          onClick={clearAttendance}
          variant="outline"
          className="flex-1 text-xs border-destructive/50 hover:bg-destructive/10 text-destructive"
        >
          <Trash2 className="w-4 h-4 mr-1" />
          Clear
        </Button>
      </div>

      {/* Recent Records */}
      {filteredAttendance.length > 0 && (
        <div className="space-y-2 pt-4 border-t border-border max-h-48 overflow-y-auto">
          <h4 className="text-sm font-medium text-foreground/80">Today's Attendance</h4>
          {filteredAttendance.slice(0, 10).map((record, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between text-sm p-2 rounded bg-background/50 border border-border/30"
            >
              <div>
                <div className="font-medium text-foreground">{record.studentName}</div>
                <div className="text-xs text-foreground/60">{record.studentId}</div>
              </div>
              <div className="text-right">
                <div className="font-medium text-foreground">{record.time}</div>
                <div className="text-xs text-foreground/60">
                  {(record.confidence * 100).toFixed(0)}%
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}
