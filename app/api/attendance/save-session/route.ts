export async function POST(request: Request) {
  try {
    const { classId, className, startTime, endTime, markedStudents, allStudents } = await request.json()

    console.log("[v0] Attendance session saved:", {
      classId,
      className,
      startTime,
      endTime,
      totalStudents: markedStudents.length,
    })

    // Build attendance records from marked students
    const today = new Date().toISOString().split('T')[0]
    const attendanceRecords = markedStudents.map((student: any) => ({
      studentId: student.id,
      classId: classId,
      date: today,
      status: student.method === 'face_recognition' ? 'present' : 'present',
      method: student.method,
      markedAt: student.markedAt,
      confidence: student.confidence || 0,
    }))

    // Mark absent students
    const absentStudents = (allStudents || []).filter((s: any) => 
      !markedStudents.find((m: any) => m.id === s.id) && s.status === 'absent'
    )
    
    const absentRecords = absentStudents.map((student: any) => ({
      studentId: student.id,
      classId: classId,
      date: today,
      status: 'absent',
      method: 'manual',
      markedAt: new Date().toISOString(),
      confidence: 0,
    }))

    const allRecords = [...attendanceRecords, ...absentRecords]

    // Save to localStorage (in real app, save to database)
    if (typeof window !== 'undefined') {
      const existingRecords = JSON.parse(localStorage.getItem('attendanceRecords') || '[]')
      const updatedRecords = [...existingRecords, ...allRecords]
      localStorage.setItem('attendanceRecords', JSON.stringify(updatedRecords))
    }

    console.log(`[v0] Saved ${allRecords.length} attendance records for ${className}`)

    return Response.json({
      success: true,
      sessionId: `session_${Date.now()}`,
      totalMarked: markedStudents.length,
      totalRecords: allRecords.length,
      message: "Attendance session saved successfully",
    })
  } catch (error) {
    console.error("Session save error:", error)
    return Response.json({ success: false, error: "Failed to save session" }, { status: 500 })
  }
}
