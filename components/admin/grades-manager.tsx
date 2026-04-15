'use client'

import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Plus, Trash2, Edit2, Save, X, Download } from 'lucide-react'

interface GradeEntry {
  id: string
  studentId: string
  studentName: string
  classId: string
  category: string
  marks: number
  maxMarks: number
  date: string
  remarks?: string
}

interface GradeCategory {
  name: string
  icon: string
}

const GRADE_CATEGORIES: GradeCategory[] = [
  { name: 'Assignment', icon: '📝' },
  { name: 'Quiz', icon: '❓' },
  { name: 'Project', icon: '🎨' },
  { name: 'Mid Term', icon: '📋' },
  { name: 'Final Term', icon: '🏆' },
  { name: 'Class Task', icon: '✓' },
]

export function GradesManager() {
  const [activeTab, setActiveTab] = useState<'upload' | 'view'>('upload')
  const [grades, setGrades] = useState<GradeEntry[]>([])
  const [classes, setClasses] = useState<any[]>([])
  const [students, setStudents] = useState<any[]>([])
  const [selectedClass, setSelectedClass] = useState<string>('')
  const [selectedCategory, setSelectedCategory] = useState<string>('Assignment')
  const [editingGrade, setEditingGrade] = useState<GradeEntry | null>(null)

  const [formData, setFormData] = useState({
    studentId: '',
    studentName: '',
    marks: '',
    maxMarks: '100',
    remarks: '',
  })

  // Load data from localStorage
  useEffect(() => {
    const adminData = localStorage.getItem('adminData')
    const gradesData = localStorage.getItem('gradesData')

    if (adminData) {
      const parsed = JSON.parse(adminData)
      const loadedClasses = parsed.classes || []
      let loadedStudents = parsed.students || []
      
      // Filter students to only show those enrolled in existing classes
      loadedStudents = loadedStudents.filter((student: any) => {
        const classIds = student.classIds || (student.classId ? [student.classId] : [])
        return classIds.some((cid: string) => loadedClasses.some((cls: any) => cls.id === cid))
      })
      
      setClasses(loadedClasses)
      setStudents(loadedStudents)
      console.log('[v0] Grades Manager: Loaded', loadedStudents.length, 'students from', loadedClasses.length, 'classes')
    }

    if (gradesData) {
      setGrades(JSON.parse(gradesData))
    }
  }, [])

  // Save grades to localStorage
  const saveGrades = (updatedGrades: GradeEntry[]) => {
    localStorage.setItem('gradesData', JSON.stringify(updatedGrades))
    setGrades(updatedGrades)
  }

  // Get students for selected class (support both classId and classIds)
  const classStudents = students.filter(s => {
    const classIds = s.classIds || (s.classId ? [s.classId] : [])
    return classIds.includes(selectedClass)
  })

  // Upload grades
  const handleUploadGrade = () => {
    if (!selectedClass || !formData.studentId || !formData.marks) {
      alert('Please fill in all required fields')
      return
    }

    if (editingGrade) {
      // Update existing grade
      const updated = grades.map(g =>
        g.id === editingGrade.id
          ? {
              ...g,
              studentId: formData.studentId,
              studentName: formData.studentName,
              category: selectedCategory,
              marks: parseFloat(formData.marks),
              maxMarks: parseFloat(formData.maxMarks),
              remarks: formData.remarks,
            }
          : g
      )
      saveGrades(updated)
      setEditingGrade(null)
    } else {
      // Add new grade
      const newGrade: GradeEntry = {
        id: `GRADE-${Date.now()}`,
        studentId: formData.studentId,
        studentName: formData.studentName,
        classId: selectedClass,
        category: selectedCategory,
        marks: parseFloat(formData.marks),
        maxMarks: parseFloat(formData.maxMarks),
        date: new Date().toISOString().split('T')[0],
        remarks: formData.remarks,
      }
      saveGrades([...grades, newGrade])
    }

    // Reset form
    setFormData({ studentId: '', studentName: '', marks: '', maxMarks: '100', remarks: '' })
    alert(editingGrade ? 'Grade updated successfully!' : 'Grade uploaded successfully!')
  }

  // Edit grade
  const handleEditGrade = (grade: GradeEntry) => {
    setEditingGrade(grade)
    setSelectedClass(grade.classId)
    setSelectedCategory(grade.category)
    setFormData({
      studentId: grade.studentId,
      studentName: grade.studentName,
      marks: grade.marks.toString(),
      maxMarks: grade.maxMarks.toString(),
      remarks: grade.remarks || '',
    })
  }

  // Delete grade
  const handleDeleteGrade = (id: string) => {
    if (confirm('Are you sure you want to delete this grade?')) {
      const updated = grades.filter(g => g.id !== id)
      saveGrades(updated)
    }
  }

  // Export grades to CSV
  const exportToCSV = () => {
    const selectedClassGrades = grades.filter(g => g.classId === selectedClass)
    if (selectedClassGrades.length === 0) {
      alert('No grades to export for this class')
      return
    }

    const csv = [
      ['Student Name', 'Category', 'Marks', 'Max Marks', 'Percentage', 'Date', 'Remarks'],
      ...selectedClassGrades.map(g => [
        g.studentName,
        g.category,
        g.marks,
        g.maxMarks,
        `${((g.marks / g.maxMarks) * 100).toFixed(2)}%`,
        g.date,
        g.remarks || '',
      ]),
    ]
      .map(row => row.join(','))
      .join('\n')

    const blob = new Blob([csv], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `grades-${selectedClass}-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
  }

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="flex gap-2 border-b border-border">
        <Button
          variant={activeTab === 'upload' ? 'default' : 'ghost'}
          onClick={() => setActiveTab('upload')}
        >
          Upload Grades
        </Button>
        <Button
          variant={activeTab === 'view' ? 'default' : 'ghost'}
          onClick={() => setActiveTab('view')}
        >
          View Grades
        </Button>
      </div>

      {/* UPLOAD TAB */}
      {activeTab === 'upload' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Grade Categories */}
          <Card className="p-6">
            <h3 className="text-lg font-semibold text-foreground mb-4">Assessment Categories</h3>
            <div className="grid grid-cols-2 gap-3">
              {GRADE_CATEGORIES.map(cat => (
                <button
                  key={cat.name}
                  onClick={() => setSelectedCategory(cat.name)}
                  className={`p-3 rounded-lg border transition-all ${
                    selectedCategory === cat.name
                      ? 'border-primary bg-primary/10'
                      : 'border-border hover:border-primary'
                  }`}
                >
                  <div className="text-2xl mb-1">{cat.icon}</div>
                  <p className="text-sm font-medium text-foreground">{cat.name}</p>
                </button>
              ))}
            </div>
          </Card>

          {/* Grade Form */}
          <Card className="p-6">
            <h3 className="text-lg font-semibold text-foreground mb-4">
              {editingGrade ? 'Edit Grade' : 'Upload Grade'}
            </h3>
            <div className="space-y-4">
              {/* Select Class */}
              <div>
                <label className="text-sm font-medium text-foreground block mb-2">Select Class</label>
                <select
                  value={selectedClass}
                  onChange={e => {
                    setSelectedClass(e.target.value)
                    setFormData({ ...formData, studentId: '', studentName: '' })
                  }}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground"
                >
                  <option value="">-- Select Class --</option>
                  {classes.map(cls => (
                    <option key={cls.id} value={cls.id}>
                      {cls.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Select Student */}
              {selectedClass && (
                <div>
                  <label className="text-sm font-medium text-foreground block mb-2">Select Student</label>
                  <select
                    value={formData.studentId}
                    onChange={e => {
                      const student = classStudents.find(s => s.id === e.target.value)
                      setFormData({
                        ...formData,
                        studentId: e.target.value,
                        studentName: student?.name || '',
                      })
                    }}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground"
                  >
                    <option value="">-- Select Student --</option>
                    {classStudents.map(student => (
                      <option key={student.id} value={student.id}>
                        {student.name} ({student.rollNumber})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Marks Input */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium text-foreground block mb-2">Marks Obtained</label>
                  <Input
                    type="number"
                    value={formData.marks}
                    onChange={e => setFormData({ ...formData, marks: e.target.value })}
                    placeholder="0"
                    className="bg-background"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground block mb-2">Max Marks</label>
                  <Input
                    type="number"
                    value={formData.maxMarks}
                    onChange={e => setFormData({ ...formData, maxMarks: e.target.value })}
                    placeholder="100"
                    className="bg-background"
                  />
                </div>
              </div>

              {/* Remarks */}
              <div>
                <label className="text-sm font-medium text-foreground block mb-2">Remarks (Optional)</label>
                <Input
                  value={formData.remarks}
                  onChange={e => setFormData({ ...formData, remarks: e.target.value })}
                  placeholder="Add any remarks..."
                  className="bg-background"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 pt-4">
                <Button onClick={handleUploadGrade} className="flex-1 gap-2">
                  <Save className="w-4 h-4" />
                  {editingGrade ? 'Update Grade' : 'Upload Grade'}
                </Button>
                {editingGrade && (
                  <Button
                    onClick={() => {
                      setEditingGrade(null)
                      setFormData({
                        studentId: '',
                        studentName: '',
                        marks: '',
                        maxMarks: '100',
                        remarks: '',
                      })
                    }}
                    variant="outline"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* VIEW TAB */}
      {activeTab === 'view' && (
        <div className="space-y-4">
          {/* Class Filter */}
          <Card className="p-4">
            <div className="flex gap-3">
              <select
                value={selectedClass}
                onChange={e => setSelectedClass(e.target.value)}
                className="px-3 py-2 rounded-lg border border-border bg-background text-foreground flex-1"
              >
                <option value="">-- Select Class to View --</option>
                {classes.map(cls => (
                  <option key={cls.id} value={cls.id}>
                    {cls.name}
                  </option>
                ))}
              </select>
              {selectedClass && (
                <Button onClick={exportToCSV} className="gap-2">
                  <Download className="w-4 h-4" />
                  Export
                </Button>
              )}
            </div>
          </Card>

          {/* Grades Table */}
          <Card className="p-6">
            {grades.filter(g => g.classId === selectedClass).length === 0 ? (
              <p className="text-foreground/60 text-center py-8">
                {selectedClass ? 'No grades uploaded for this class yet' : 'Select a class to view grades'}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-3 px-3 font-semibold text-foreground">Student</th>
                      <th className="text-left py-3 px-3 font-semibold text-foreground">Category</th>
                      <th className="text-center py-3 px-3 font-semibold text-foreground">Marks</th>
                      <th className="text-center py-3 px-3 font-semibold text-foreground">Percentage</th>
                      <th className="text-left py-3 px-3 font-semibold text-foreground">Date</th>
                      <th className="text-center py-3 px-3 font-semibold text-foreground">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {grades
                      .filter(g => g.classId === selectedClass)
                      .map(grade => (
                        <tr key={grade.id} className="border-b border-border hover:bg-background/50">
                          <td className="py-3 px-3">
                            <div>
                              <p className="font-medium text-foreground">{grade.studentName}</p>
                              <p className="text-xs text-foreground/60">{grade.studentId}</p>
                            </div>
                          </td>
                          <td className="py-3 px-3">
                            <Badge className="bg-primary/20 text-primary">{grade.category}</Badge>
                          </td>
                          <td className="py-3 px-3 text-center">
                            <p className="font-semibold text-foreground">
                              {grade.marks}/{grade.maxMarks}
                            </p>
                          </td>
                          <td className="py-3 px-3 text-center">
                            <p className="font-semibold text-accent">
                              {((grade.marks / grade.maxMarks) * 100).toFixed(2)}%
                            </p>
                          </td>
                          <td className="py-3 px-3 text-foreground/60">{grade.date}</td>
                          <td className="py-3 px-3 text-center">
                            <div className="flex gap-2 justify-center">
                              <Button
                                onClick={() => handleEditGrade(grade)}
                                size="sm"
                                variant="ghost"
                              >
                                <Edit2 className="w-4 h-4" />
                              </Button>
                              <Button
                                onClick={() => handleDeleteGrade(grade.id)}
                                size="sm"
                                variant="ghost"
                                className="text-destructive hover:text-destructive"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  )
}
