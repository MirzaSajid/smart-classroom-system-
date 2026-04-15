'use client'

import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Plus, Trash2, Edit2, Save, X, Users, BookOpen, FileText, BarChart3, Video, Smile } from 'lucide-react'
import { StudentAnalytics } from './student-analytics'
import { CameraManagement } from './camera-management'
import { FacialRecognitionSetup } from './facial-recognition-setup'
import { cleanupAllData } from '@/lib/data-cleanup'

interface Student {
  id: string
  name: string
  email: string
  password: string
  rollNumber: string
  classIds: string[]
  parentContact: string
}

interface Section {
  id: string
  name: string
  classId: string
}

interface ClassData {
  id: string
  name: string
  classTeacher: string
  totalStudents: number
  sections: Section[]
  day?: string // Day of week: Monday, Tuesday, etc.
  startTime?: string // Start time in HH:MM format
  endTime?: string // End time in HH:MM format
}

interface AdminData {
  classes: ClassData[]
  students: Student[]
}

export function AdminDataManager() {
  const [activeTab, setActiveTab] = useState<'classes' | 'sections' | 'students' | 'reports' | 'todaysclasses' | 'analytics' | 'enrollment' | 'cameras' | 'facial'>('classes')
  const [classes, setClasses] = useState<ClassData[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [editingClass, setEditingClass] = useState<ClassData | null>(null)
  const [editingStudent, setEditingStudent] = useState<Student | null>(null)
  const [selectedClassId, setSelectedClassId] = useState<string>('')

  const [newClass, setNewClass] = useState({
    name: '',
    classTeacher: '',
    day: 'Monday',
    startTime: '09:00',
    endTime: '10:00',
  })

  const [newStudent, setNewStudent] = useState({
    studentId: '',
    name: '',
    email: '',
    password: 'student123',
    rollNumber: '',
    parentContact: '',
  })

  const [newSection, setNewSection] = useState({
    name: '',
  })

  // Load data from localStorage
  useEffect(() => {
    const stored = localStorage.getItem('adminData')
    if (stored) {
      try {
        const data = JSON.parse(stored)
        const loadedClasses = data.classes || []
        let loadedStudents = data.students || []
        
        // Migrate old student data format (classId) to new format (classIds)
        const migratedStudents = loadedStudents.map((student: any) => ({
          ...student,
          classIds: student.classIds || (student.classId ? [student.classId] : []),
        }))
        
        console.log('[v0] Loaded', loadedClasses.length, 'classes and', migratedStudents.length, 'students')
        setClasses(loadedClasses)
        setStudents(migratedStudents)
        
        // Save migrated data back (format update only, no removal of students)
        localStorage.setItem('adminData', JSON.stringify({
          classes: loadedClasses,
          students: migratedStudents,
        }))
        
        // Clean up related records (attendance, grades, facial data)
        cleanupAllData()
      } catch (e) {
        console.error('[v0] Failed to load admin data:', e)
      }
    }
  }, [])

  // Save data to localStorage
  const saveData = (updatedClasses?: ClassData[], updatedStudents?: Student[]) => {
    const data: AdminData = {
      classes: updatedClasses || classes,
      students: updatedStudents || students,
    }
    localStorage.setItem('adminData', JSON.stringify(data))
  }

  // CLASS MANAGEMENT
  const addClass = () => {
    if (!newClass.name || !newClass.classTeacher) {
      alert('Please fill in all fields')
      return
    }
    if (!newClass.day || !newClass.startTime || !newClass.endTime) {
      alert('Please fill in schedule details')
      return
    }
    const classId = `CLASS-${Date.now()}`
    const updatedClasses = [...classes, {
      id: classId,
      name: newClass.name,
      classTeacher: newClass.classTeacher,
      totalStudents: 0,
      sections: [],
      day: newClass.day,
      startTime: newClass.startTime,
      endTime: newClass.endTime,
    }]
    setClasses(updatedClasses)
    saveData(updatedClasses)
    setNewClass({ name: '', classTeacher: '', day: 'Monday', startTime: '09:00', endTime: '10:00' })
  }

  const deleteClass = (id: string) => {
    if (confirm('Delete this class? All associated sections and students will be affected.')) {
      const updatedClasses = classes.filter((c) => c.id !== id)
      
      // Remove class from students' classIds array
      // Only keep students who have other courses
      const updatedStudents = students
        .map((s) => ({
          ...s,
          classIds: (s.classIds || []).filter((cid) => cid !== id),
        }))
        .filter((s) => s.classIds && s.classIds.length > 0) // Remove students with no courses
      
      setClasses(updatedClasses)
      setStudents(updatedStudents)
      saveData(updatedClasses, updatedStudents)
      
      // Cleanup orphaned records
      cleanupAllData()
      console.log('[v0] Deleted class and cleaned up orphaned records')
    }
  }

  const updateClass = (id: string, updatedClass: ClassData) => {
    const updatedClasses = classes.map((c) => (c.id === id ? updatedClass : c))
    setClasses(updatedClasses)
    saveData(updatedClasses)
    setEditingClass(null)
  }

  // SECTION MANAGEMENT
  const addSection = (classId: string) => {
    if (!newSection.name) {
      alert('Please enter section name')
      return
    }
    const updatedClasses = classes.map((c) => {
      if (c.id === classId) {
        return {
          ...c,
          sections: [...c.sections, { id: `SEC-${Date.now()}`, name: newSection.name, classId }],
        }
      }
      return c
    })
    setClasses(updatedClasses)
    saveData(updatedClasses)
    setNewSection({ name: '' })
  }

  const deleteSection = (classId: string, sectionId: string) => {
    if (confirm('Delete this section?')) {
      const updatedClasses = classes.map((c) => {
        if (c.id === classId) {
          return {
            ...c,
            sections: c.sections.filter((s) => s.id !== sectionId),
          }
        }
        return c
      })
      setClasses(updatedClasses)
      saveData(updatedClasses)
    }
  }

  // STUDENT MANAGEMENT
  const addStudent = (classId: string) => {
    if (!newStudent.studentId || !newStudent.name || !newStudent.email || !newStudent.rollNumber || !newStudent.parentContact) {
      alert('Please fill in all required fields (Student ID, Name, Registration Number, Email, Cell Number)')
      return
    }
    const updatedStudents = [...students, {
      id: newStudent.studentId.trim(),
      name: newStudent.name,
      email: newStudent.email,
      password: newStudent.password || 'student123',
      rollNumber: newStudent.rollNumber,
      classIds: [classId],
      parentContact: newStudent.parentContact,
    }]
    setStudents(updatedStudents)
    
    // Update class total students count
    const updatedClasses = classes.map((c) => {
      if (c.id === classId) {
        return { ...c, totalStudents: c.totalStudents + 1 }
      }
      return c
    })
    setClasses(updatedClasses)
    saveData(updatedClasses, updatedStudents)
    setNewStudent({ studentId: '', name: '', email: '', password: 'student123', rollNumber: '', parentContact: '' })
  }

  const deleteStudent = (studentId: string) => {
    if (confirm('Delete this student?')) {
      const student = students.find((s) => s.id === studentId)
      const updatedStudents = students.filter((s) => s.id !== studentId)
      setStudents(updatedStudents)
      
      // Update class count for all enrolled classes
      const updatedClasses = classes.map((c) => {
        const classIds = student?.classIds || []
        if (classIds.includes(c.id)) {
          return { ...c, totalStudents: Math.max(0, c.totalStudents - 1) }
        }
        return c
      })
      setClasses(updatedClasses)
      saveData(updatedClasses, updatedStudents)
    }
  }

  const updateStudent = (studentId: string, updatedStudent: Student) => {
    const updatedStudents = students.map((s) => (s.id === studentId ? updatedStudent : s))
    setStudents(updatedStudents)
    saveData(undefined, updatedStudents)
    setEditingStudent(null)
  }

  const getClassStudents = (classId: string) =>
    students.filter((s) => (s.classIds || []).includes(classId))
  const getSelectedClass = () => classes.find((c) => c.id === selectedClassId)

  // Reset all data
  const resetAllData = () => {
    if (confirm('Are you sure you want to delete ALL data? This action cannot be undone.')) {
      if (confirm('This will permanently delete all classes, students, and records. Click OK to confirm.')) {
        localStorage.removeItem('adminData')
        localStorage.removeItem('attendanceRecords')
        localStorage.removeItem('studentDataset')
        localStorage.removeItem('gradesData')
        setClasses([])
        setStudents([])
        setActiveTab('classes')
        alert('All data has been cleared. The system is now reset.')
        console.log('[v0] All data has been reset')
      }
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground mb-2">Campus Management</h2>
          <p className="text-foreground/60">Manage classes, sections, students, and view reports</p>
        </div>
        <Button
          variant="destructive"
          size="sm"
          onClick={resetAllData}
          className="gap-2"
        >
          <Trash2 className="w-4 h-4" />
          Reset All Data
        </Button>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-2 border-b border-border mb-6 overflow-x-auto">
        <Button
          variant={activeTab === 'classes' ? 'default' : 'ghost'}
          onClick={() => setActiveTab('classes')}
          className="gap-2"
        >
          <BookOpen className="w-4 h-4" />
          Manage Classes
        </Button>
        <Button
          variant={activeTab === 'sections' ? 'default' : 'ghost'}
          onClick={() => setActiveTab('sections')}
          className="gap-2"
        >
          <Users className="w-4 h-4" />
          Manage Sections
        </Button>
        <Button
          variant={activeTab === 'students' ? 'default' : 'ghost'}
          onClick={() => setActiveTab('students')}
          className="gap-2"
        >
          <Users className="w-4 h-4" />
          Manage Students
        </Button>
        <Button
          variant={activeTab === 'enrollment' ? 'default' : 'ghost'}
          onClick={() => setActiveTab('enrollment')}
          className="gap-2"
        >
          <Users className="w-4 h-4" />
          Course Enrollment
        </Button>
        <Button
          variant={activeTab === 'todaysclasses' ? 'default' : 'ghost'}
          onClick={() => setActiveTab('todaysclasses')}
          className="gap-2"
        >
          <BookOpen className="w-4 h-4" />
          Today's Classes
        </Button>
        <Button
          variant={activeTab === 'facial' ? 'default' : 'ghost'}
          onClick={() => setActiveTab('facial')}
          className="gap-2"
        >
          <Smile className="w-4 h-4" />
          Facial Recognition
        </Button>
        <Button
          variant={activeTab === 'cameras' ? 'default' : 'ghost'}
          onClick={() => setActiveTab('cameras')}
          className="gap-2"
        >
          <Video className="w-4 h-4" />
          Camera Setup
        </Button>
        <Button
          variant={activeTab === 'analytics' ? 'default' : 'ghost'}
          onClick={() => setActiveTab('analytics')}
          className="gap-2"
        >
          <BarChart3 className="w-4 h-4" />
          Student Analytics
        </Button>
        <Button
          variant={activeTab === 'reports' ? 'default' : 'ghost'}
          onClick={() => setActiveTab('reports')}
          className="gap-2"
        >
          <FileText className="w-4 h-4" />
          Reports
        </Button>
      </div>

      {/* MANAGE CLASSES TAB */}
      {activeTab === 'classes' && (
        <div className="space-y-4">
          <Card className="p-6">
            <h3 className="text-lg font-semibold text-foreground mb-4">Add New Class</h3>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Input
                  placeholder="e.g., Computer Science 101"
                  value={newClass.name}
                  onChange={(e) => setNewClass({ ...newClass, name: e.target.value })}
                />
                <Input
                  placeholder="Class Teacher Name"
                  value={newClass.classTeacher}
                  onChange={(e) => setNewClass({ ...newClass, classTeacher: e.target.value })}
                />
              </div>
              
              {/* Schedule Section */}
              <div className="border-t pt-4">
                <h4 className="text-sm font-semibold text-foreground mb-3">Class Schedule</h4>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="text-sm text-foreground/60 mb-2 block">Day of Week</label>
                    <select
                      value={newClass.day}
                      onChange={(e) => setNewClass({ ...newClass, day: e.target.value })}
                      className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground"
                    >
                      <option value="Monday">Monday</option>
                      <option value="Tuesday">Tuesday</option>
                      <option value="Wednesday">Wednesday</option>
                      <option value="Thursday">Thursday</option>
                      <option value="Friday">Friday</option>
                      <option value="Saturday">Saturday</option>
                      <option value="Sunday">Sunday</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="text-sm text-foreground/60 mb-2 block">Start Time</label>
                    <input
                      type="time"
                      value={newClass.startTime}
                      onChange={(e) => setNewClass({ ...newClass, startTime: e.target.value })}
                      className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground"
                    />
                  </div>
                  
                  <div>
                    <label className="text-sm text-foreground/60 mb-2 block">End Time</label>
                    <input
                      type="time"
                      value={newClass.endTime}
                      onChange={(e) => setNewClass({ ...newClass, endTime: e.target.value })}
                      className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground"
                    />
                  </div>
                </div>
              </div>
              
              <Button onClick={addClass} className="w-full">
                <Plus className="w-4 h-4 mr-2" />
                Add Class
              </Button>
            </div>
          </Card>

          <div className="space-y-2">
            <h3 className="text-lg font-semibold text-foreground">Classes ({classes.length})</h3>
            {classes.length === 0 ? (
              <Card className="p-6 text-center text-foreground/60">No classes added yet</Card>
            ) : (
              classes.map((cls) => (
                <Card key={cls.id} className="p-4">
                  {editingClass?.id === cls.id ? (
                    <div className="space-y-3">
                      <Input
                        value={editingClass.name}
                        onChange={(e) => setEditingClass({ ...editingClass, name: e.target.value })}
                        placeholder="Class name"
                      />
                      <Input
                        value={editingClass.classTeacher}
                        onChange={(e) => setEditingClass({ ...editingClass, classTeacher: e.target.value })}
                        placeholder="Teacher name"
                      />
                      
                      {/* Schedule Edit Section */}
                      <div className="border-t pt-3">
                        <h5 className="text-sm font-semibold text-foreground mb-2">Schedule</h5>
                        <div className="grid grid-cols-3 gap-2">
                          <select
                            value={editingClass.day || 'Monday'}
                            onChange={(e) => setEditingClass({ ...editingClass, day: e.target.value })}
                            className="w-full px-2 py-1 border border-border rounded text-sm bg-background text-foreground"
                          >
                            <option value="Monday">Monday</option>
                            <option value="Tuesday">Tuesday</option>
                            <option value="Wednesday">Wednesday</option>
                            <option value="Thursday">Thursday</option>
                            <option value="Friday">Friday</option>
                            <option value="Saturday">Saturday</option>
                            <option value="Sunday">Sunday</option>
                          </select>
                          <input
                            type="time"
                            value={editingClass.startTime || '09:00'}
                            onChange={(e) => setEditingClass({ ...editingClass, startTime: e.target.value })}
                            className="w-full px-2 py-1 border border-border rounded text-sm bg-background text-foreground"
                          />
                          <input
                            type="time"
                            value={editingClass.endTime || '10:00'}
                            onChange={(e) => setEditingClass({ ...editingClass, endTime: e.target.value })}
                            className="w-full px-2 py-1 border border-border rounded text-sm bg-background text-foreground"
                          />
                        </div>
                      </div>
                      
                      <div className="flex gap-2">
                        <Button onClick={() => updateClass(cls.id, editingClass)} size="sm" className="flex-1">
                          <Save className="w-4 h-4 mr-2" />
                          Save
                        </Button>
                        <Button onClick={() => setEditingClass(null)} size="sm" variant="outline" className="flex-1">
                          <X className="w-4 h-4 mr-2" />
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <h4 className="font-semibold text-foreground">{cls.name}</h4>
                        <div className="flex flex-wrap gap-4 text-sm text-foreground/60 mt-2">
                          <span>Teacher: {cls.classTeacher}</span>
                          <span>Students: {cls.totalStudents}</span>
                          {cls.day && (
                            <>
                              <span>Day: {cls.day}</span>
                              <span>Time: {cls.startTime} - {cls.endTime}</span>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button onClick={() => setEditingClass(cls)} size="sm" variant="outline">
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button onClick={() => deleteClass(cls.id)} size="sm" variant="outline" className="text-destructive">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </Card>
              ))
            )}
          </div>
        </div>
      )}

      {/* MANAGE SECTIONS TAB */}
      {activeTab === 'sections' && (
        <div className="space-y-4">
          <Card className="p-6">
            <h3 className="text-lg font-semibold text-foreground mb-4">Select Class to Manage Sections</h3>
            <div className="space-y-4">
              <select
                value={selectedClassId}
                onChange={(e) => setSelectedClassId(e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground"
              >
                <option value="">Choose a class...</option>
                {classes.map((cls) => (
                  <option key={cls.id} value={cls.id}>
                    {cls.name} ({cls.sections.length} sections)
                  </option>
                ))}
              </select>
            </div>
          </Card>

          {selectedClassId && getSelectedClass() && (
            <Card className="p-6">
              <h3 className="text-lg font-semibold text-foreground mb-4">Add Section to {getSelectedClass()?.name}</h3>
              <div className="space-y-4">
                <Input
                  placeholder="e.g., Section A"
                  value={newSection.name}
                  onChange={(e) => setNewSection({ name: e.target.value })}
                />
                <Button onClick={() => addSection(selectedClassId)} className="w-full">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Section
                </Button>
              </div>

              <div className="mt-6 space-y-2">
                <h4 className="font-semibold text-foreground">Sections ({getSelectedClass()?.sections.length || 0})</h4>
                {getSelectedClass()?.sections.length === 0 ? (
                  <p className="text-foreground/60 text-sm">No sections added</p>
                ) : (
                  getSelectedClass()?.sections.map((section) => (
                    <div key={section.id} className="flex items-center justify-between p-3 bg-background rounded border border-border">
                      <span className="text-foreground">{section.name}</span>
                      <Button
                        onClick={() => deleteSection(selectedClassId, section.id)}
                        size="sm"
                        variant="outline"
                        className="text-destructive"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </Card>
          )}
        </div>
      )}

      {/* MANAGE STUDENTS TAB */}
      {activeTab === 'students' && (
        <div className="space-y-4">
          <Card className="p-6">
            <h3 className="text-lg font-semibold text-foreground mb-4">Select Class to Add Students</h3>
            <select
              value={selectedClassId}
              onChange={(e) => setSelectedClassId(e.target.value)}
              className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground"
            >
              <option value="">Choose a class...</option>
              {classes.map((cls) => (
                <option key={cls.id} value={cls.id}>
                  {cls.name} ({getClassStudents(cls.id).length} students)
                </option>
              ))}
            </select>
          </Card>

          {selectedClassId && (
            <Card className="p-6">
              <h3 className="text-lg font-semibold text-foreground mb-4">Add Student to {getSelectedClass()?.name}</h3>
              <div className="space-y-4">
                <Input
                  placeholder="Student Name"
                  value={newStudent.name}
                  onChange={(e) => setNewStudent({ ...newStudent, name: e.target.value })}
                />
                <Input
                  placeholder="Student ID"
                  value={newStudent.studentId}
                  onChange={(e) => setNewStudent({ ...newStudent, studentId: e.target.value })}
                />
                <Input
                  placeholder="Email (e.g., sajid@superior.edu.pk)"
                  type="email"
                  value={newStudent.email}
                  onChange={(e) => setNewStudent({ ...newStudent, email: e.target.value })}
                />
                <Input
                  placeholder="Registration Number"
                  value={newStudent.rollNumber}
                  onChange={(e) => setNewStudent({ ...newStudent, rollNumber: e.target.value })}
                />
                <Input
                  placeholder="Student Cell Number"
                  value={newStudent.parentContact}
                  onChange={(e) => setNewStudent({ ...newStudent, parentContact: e.target.value })}
                />
                <div className="p-3 bg-primary/10 rounded border border-primary/20">
                  <p className="text-xs text-foreground/70">
                    <span className="font-semibold">Default Password:</span> {newStudent.password}
                  </p>
                </div>
                <Button onClick={() => addStudent(selectedClassId)} className="w-full">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Student
                </Button>
              </div>

              <div className="mt-6 space-y-2">
                <h4 className="font-semibold text-foreground">Students ({getClassStudents(selectedClassId).length})</h4>
                {getClassStudents(selectedClassId).length === 0 ? (
                  <p className="text-foreground/60 text-sm">No students in this class</p>
                ) : (
                  getClassStudents(selectedClassId).map((student) => (
                    <Card key={student.id} className="p-3">
                      {editingStudent?.id === student.id ? (
                        <div className="space-y-3">
                          <Input
                            value={editingStudent.name}
                            onChange={(e) => setEditingStudent({ ...editingStudent, name: e.target.value })}
                          />
                          <Input
                            value={editingStudent.id}
                            disabled
                          />
                          <Input
                            value={editingStudent.rollNumber}
                            onChange={(e) => setEditingStudent({ ...editingStudent, rollNumber: e.target.value })}
                          />
                          <Input
                            value={editingStudent.email}
                            onChange={(e) => setEditingStudent({ ...editingStudent, email: e.target.value })}
                            placeholder="Email"
                            type="email"
                          />
                          <Input
                            value={editingStudent.parentContact}
                            onChange={(e) => setEditingStudent({ ...editingStudent, parentContact: e.target.value })}
                          />
                          <div className="flex gap-2">
                            <Button onClick={() => updateStudent(student.id, editingStudent)} size="sm" className="flex-1">
                              Save
                            </Button>
                            <Button onClick={() => setEditingStudent(null)} size="sm" variant="outline" className="flex-1">
                              Cancel
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-semibold text-foreground">{student.name}</p>
                            <p className="text-sm text-foreground/60">ID: {student.id}</p>
                            <p className="text-sm text-foreground/60">Email: {student.email}</p>
                            <p className="text-sm text-foreground/60">Roll: {student.rollNumber}</p>
                            {student.parentContact && <p className="text-sm text-foreground/60">Contact: {student.parentContact}</p>}
                          </div>
                          <div className="flex gap-2">
                            <Button onClick={() => setEditingStudent(student)} size="sm" variant="outline">
                              <Edit2 className="w-4 h-4" />
                            </Button>
                            <Button onClick={() => deleteStudent(student.id)} size="sm" variant="outline" className="text-destructive">
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      )}
                    </Card>
                  ))
                )}
              </div>
            </Card>
          )}
        </div>
      )}

      {/* COURSE ENROLLMENT TAB */}
      {activeTab === 'enrollment' && (
        <div className="space-y-4">
          <Card className="p-6">
            <h3 className="text-lg font-semibold text-foreground mb-4">Enroll Students in Courses</h3>
            <p className="text-sm text-foreground/60 mb-6">Select a student to view and manage their course enrollments</p>
            
            {students.length === 0 ? (
              <p className="text-foreground/60">No students available. Add students first.</p>
            ) : (
              <div className="space-y-4">
                {/* Show all students for enrollment management */}
                {students.map((student) => (
                  <Card key={student.id} className="p-4 bg-background border-border">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-semibold text-foreground">{student.name}</p>
                          <p className="text-sm text-foreground/60">Email: {student.email}</p>
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <p className="text-sm font-medium text-foreground">Enrolled Courses ({(student.classIds || []).length})</p>
                        <div className="flex flex-wrap gap-2">
                          {(student.classIds || []).map((classId) => {
                            const course = classes.find(c => c.id === classId)
                            return (
                              <Badge key={classId} className="bg-primary/20 text-primary">
                                {course?.name || 'Unknown Course'}
                              </Badge>
                            )
                          })}
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <p className="text-sm font-medium text-foreground">Add to Courses</p>
                        <div className="flex flex-wrap gap-2">
                          {classes.map((course) => {
                            const enrolledCourses = student.classIds || []
                            return (
                              <Button
                                key={course.id}
                                variant={enrolledCourses.includes(course.id) ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => {
                                  const currentIds = [...(student.classIds || [])]
                                  if (currentIds.includes(course.id)) {
                                    student.classIds = currentIds.filter(id => id !== course.id)
                                  } else {
                                    currentIds.push(course.id)
                                    student.classIds = currentIds
                                  }
                                  const updatedStudents = [...students]
                                  saveData(classes, updatedStudents)
                                }}
                              >
                                {course.name}
                              </Button>
                            )
                          })}
                        </div>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}

      {/* TODAY'S CLASSES TAB */}
      {activeTab === 'todaysclasses' && (
        <div className="space-y-4">
          <Card className="p-6">
            <h3 className="text-lg font-semibold text-foreground mb-4">Today's Scheduled Classes</h3>
            {classes.length === 0 ? (
              <p className="text-foreground/60">No classes created yet</p>
            ) : (
              <div className="space-y-3">
                {classes.map((cls) => {
                  const classStudents = students.filter(s => (s.classIds || []).includes(cls.id))
                  return (
                    <Card key={cls.id} className="p-4 bg-background border-border">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h4 className="font-semibold text-foreground">{cls.name}</h4>
                          <p className="text-sm text-foreground/60">Teacher: {cls.classTeacher}</p>
                          <div className="flex gap-4 mt-3">
                            <span className="text-sm text-foreground/60">
                              <span className="font-semibold">{classStudents.length}</span> Students
                            </span>
                            <span className="text-sm text-foreground/60">
                              <span className="font-semibold">{cls.sections.length}</span> Sections
                            </span>
                          </div>
                        </div>
                        <div className="text-right">
                          <Badge className="bg-primary/20 text-primary">Scheduled</Badge>
                          <p className="text-xs text-foreground/60 mt-2">9:00 AM - 10:30 AM</p>
                        </div>
                      </div>
                    </Card>
                  )
                })}
              </div>
            )}
          </Card>

          <Card className="p-6">
            <h3 className="text-lg font-semibold text-foreground mb-4">Attendance Overview</h3>
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center p-4 bg-primary/10 rounded-lg">
                <p className="text-2xl font-bold text-primary">{classes.length}</p>
                <p className="text-sm text-foreground/60 mt-2">Total Classes</p>
              </div>
              <div className="text-center p-4 bg-accent/10 rounded-lg">
                <p className="text-2xl font-bold text-accent">{students.filter(s => (s.classIds || []).length > 0).length}</p>
                <p className="text-sm text-foreground/60 mt-2">Total Students</p>
              </div>
              <div className="text-center p-4 bg-primary/5 rounded-lg border border-primary/20">
                <p className="text-2xl font-bold text-primary">-</p>
                <p className="text-sm text-foreground/60 mt-2">Present Today</p>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* FACIAL RECOGNITION TAB */}
      {activeTab === 'facial' && (
        <FacialRecognitionSetup />
      )}

      {/* CAMERA MANAGEMENT TAB */}
      {activeTab === 'cameras' && (
        <CameraManagement />
      )}

      {/* STUDENT ANALYTICS TAB */}
      {activeTab === 'analytics' && (
        <StudentAnalytics />
      )}

      {/* REPORTS & ANALYTICS TAB */}
      {activeTab === 'reports' && (
        <div className="space-y-4">
          <Card className="p-6">
            <h3 className="text-lg font-semibold text-foreground mb-4">Campus Statistics</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-primary">{classes.length}</p>
                <p className="text-sm text-foreground/60">Total Classes</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-primary">{students.filter(s => (s.classIds || []).length > 0).length}</p>
                <p className="text-sm text-foreground/60">Total Students</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-primary">{classes.reduce((sum, c) => sum + c.sections.length, 0)}</p>
                <p className="text-sm text-foreground/60">Total Sections</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-primary">{classes.length > 0 ? (students.length / classes.length).toFixed(1) : 0}</p>
                <p className="text-sm text-foreground/60">Avg Students/Class</p>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <h3 className="text-lg font-semibold text-foreground mb-4">Class Breakdown</h3>
            <div className="space-y-3">
              {classes.map((cls) => (
                <div key={cls.id} className="flex items-center justify-between p-3 bg-background rounded border border-border">
                  <div>
                    <p className="font-medium text-foreground">{cls.name}</p>
                    <p className="text-sm text-foreground/60">Teacher: {cls.classTeacher}</p>
                  </div>
                  <div className="text-right">
                    <Badge>{cls.totalStudents} Students</Badge>
                    <p className="text-sm text-foreground/60 mt-1">{cls.sections.length} Sections</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}
