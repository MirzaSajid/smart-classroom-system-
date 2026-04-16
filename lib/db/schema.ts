import { integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core"

export const classes = sqliteTable("classes", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  classTeacher: text("class_teacher").notNull(),
  totalStudents: integer("total_students").notNull().default(0),
  day: text("day"),
  startTime: text("start_time"),
  endTime: text("end_time"),
})

export const sections = sqliteTable(
  "sections",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    classId: text("class_id")
      .notNull()
      .references(() => classes.id, { onDelete: "cascade" }),
  },
  (t) => ({
    classIdNameUnique: uniqueIndex("sections_class_id_name_unique").on(t.classId, t.name),
  }),
)

export const students = sqliteTable("students", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email"),
  rollNumber: text("roll_number"),
  parentContact: text("parent_contact"),
})

export const studentEnrollments = sqliteTable(
  "student_enrollments",
  {
    studentId: text("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "cascade" }),
    classId: text("class_id")
      .notNull()
      .references(() => classes.id, { onDelete: "cascade" }),
  },
  (t) => ({
    pk: uniqueIndex("student_enrollments_unique").on(t.studentId, t.classId),
  }),
)

export const cameras = sqliteTable("cameras", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  classId: text("class_id").notNull(),
  location: text("location").notNull().default(""),
  ipAddress: text("ip_address").notNull().default(""),
  status: text("status", { enum: ["active", "inactive", "offline"] }).notNull().default("active"),
  installDate: text("install_date").notNull(),
  model: text("model").notNull().default(""),
})

export const attendanceRecords = sqliteTable(
  "attendance_records",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    studentId: text("student_id").notNull(),
    classId: text("class_id").notNull(),
    date: text("date").notNull(), // YYYY-MM-DD
    status: text("status", { enum: ["present", "absent", "late"] }).notNull(),
    method: text("method", { enum: ["manual", "face_recognition"] }).notNull(),
    markedAt: text("marked_at").notNull(),
    confidence: real("confidence").notNull().default(0),
  },
  (t) => ({
    studentClassDateUnique: uniqueIndex("attendance_student_class_date_unique").on(t.studentId, t.classId, t.date),
  }),
)

export const studentDataset = sqliteTable(
  "student_dataset",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    studentId: text("student_id").notNull(),
    studentName: text("student_name").notNull(),
    imageData: text("image_data").notNull(),
    uploadedAt: text("uploaded_at").notNull(),
    embeddingJson: text("embedding_json"),
  },
  (t) => ({
    studentIdUnique: uniqueIndex("student_dataset_student_id_unique").on(t.studentId),
  }),
)

export const appState = sqliteTable("app_state", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: text("updated_at").notNull(),
})

