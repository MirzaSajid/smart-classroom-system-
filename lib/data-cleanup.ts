/**
 * Data cleanup utilities for maintaining data integrity
 * Removes orphaned records for deleted classes and students
 */

export function cleanupAttendanceRecords() {
  try {
    const adminDataStr = localStorage.getItem('adminData')
    const attendanceStr = localStorage.getItem('attendanceRecords')
    
    if (!attendanceStr) return
    
    const adminData = adminDataStr ? JSON.parse(adminDataStr) : { classes: [], students: [] }
    const attendanceRecords = JSON.parse(attendanceStr)
    
    const validClassIds = new Set((adminData.classes || []).map((c: any) => c.id))
    const validStudentIds = new Set((adminData.students || []).map((s: any) => s.id))
    
    // Keep only records for valid classes and students
    const cleanedRecords = attendanceRecords.filter((record: any) => 
      validClassIds.has(record.classId) && validStudentIds.has(record.studentId)
    )
    
    if (cleanedRecords.length !== attendanceRecords.length) {
      localStorage.setItem('attendanceRecords', JSON.stringify(cleanedRecords))
      console.log('[v0] Cleaned up attendance records:', 
        attendanceRecords.length - cleanedRecords.length, 'records removed')
    }
  } catch (e) {
    console.error('[v0] Error cleaning attendance records:', e)
  }
}

export function cleanupGradesData() {
  try {
    const adminDataStr = localStorage.getItem('adminData')
    const gradesStr = localStorage.getItem('gradesData')
    
    if (!gradesStr) return
    
    const adminData = adminDataStr ? JSON.parse(adminDataStr) : { classes: [], students: [] }
    const gradesData = JSON.parse(gradesStr)
    
    const validClassIds = new Set((adminData.classes || []).map((c: any) => c.id))
    const validStudentIds = new Set((adminData.students || []).map((s: any) => s.id))
    
    // Keep only records for valid classes and students
    const cleanedGrades = gradesData.filter((grade: any) => 
      validClassIds.has(grade.classId) && validStudentIds.has(grade.studentId)
    )
    
    if (cleanedGrades.length !== gradesData.length) {
      localStorage.setItem('gradesData', JSON.stringify(cleanedGrades))
      console.log('[v0] Cleaned up grades data:', 
        gradesData.length - cleanedGrades.length, 'records removed')
    }
  } catch (e) {
    console.error('[v0] Error cleaning grades data:', e)
  }
}

export function cleanupFacialDataset() {
  try {
    const adminDataStr = localStorage.getItem('adminData')
    const datasetStr = localStorage.getItem('studentDataset')
    
    if (!datasetStr) return
    
    const adminData = adminDataStr ? JSON.parse(adminDataStr) : { students: [] }
    const dataset = JSON.parse(datasetStr)
    
    const validStudentIds = new Set((adminData.students || []).map((s: any) => s.id))
    
    // Keep only facial data for valid students
    const cleanedDataset = dataset.filter((biometric: any) => 
      validStudentIds.has(biometric.studentId)
    )
    
    if (cleanedDataset.length !== dataset.length) {
      localStorage.setItem('studentDataset', JSON.stringify(cleanedDataset))
      console.log('[v0] Cleaned up facial dataset:', 
        dataset.length - cleanedDataset.length, 'records removed')
    }
  } catch (e) {
    console.error('[v0] Error cleaning facial dataset:', e)
  }
}

export function cleanupAllData() {
  cleanupAttendanceRecords()
  cleanupGradesData()
  cleanupFacialDataset()
  console.log('[v0] All data cleanup completed')
}
