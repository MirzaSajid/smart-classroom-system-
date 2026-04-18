# Smart Classroom System

AI-enabled smart classroom platform built with Next.js for:
- Admin management (classes, students, faculty, enrollment, analytics)
- Teacher operations (facial attendance, dataset, grades)
- Student portal (attendance, courses, grades)

## Tech Stack

- Next.js 16 + React 19 + TypeScript
- Tailwind + Radix UI components
- SQLite (`better-sqlite3`) + Drizzle ORM
- Face recognition with `@vladmandic/face-api` + TensorFlow.js

---

## 1) Quick Start

### Prerequisites

- Node.js 18+ (LTS recommended)
- npm
- Git
- A webcam (for facial attendance features)

### Clone and Run

```bash
git clone https://github.com/MirzaSajid/smart-classroom-system-.git
cd smart-classroom-system-
npm install
npm run dev
```

Open: [http://localhost:3000](http://localhost:3000)

---

## 2) Project Configuration

### Database

By default, the app uses:

- `./data/dev.db`

You can override with:

```bash
DATABASE_URL=file:./data/dev.db
```

### Face Models

The required model manifests are already included under:

- `public/models/`

If face model loading fails, verify this folder exists with model files.

---

## 3) Login and Roles

## Admin

- Demo credentials:
  - Email: `admin@campus.edu`
  - Password: `admin123`
- Access to management dashboard and data settings.

## Teacher (Faculty)

- Teacher login is created by Admin in **Faculty** tab.
- Admin defines:
  - Teacher ID
  - Name
  - Email
  - Password (default suggestion: `teacher123`)

## Student

- Student account is created by Admin in **Manage Students**.
- Student logs in using admin-assigned email/password.

---

## 4) Complete Workflow (Recommended)

## Step A: Admin Initial Setup

1. Login as Admin.
2. Open **Settings & Data**.
3. In **Faculty** tab:
   - Add all teachers with credentials.
4. In **Manage Classes**:
   - Create classes
   - Assign each class teacher from dropdown (Faculty list)
   - Set class day/time schedule
5. In **Manage Students**:
   - Add students with ID, registration number, email, contact
6. In **Course Enrollment**:
   - Enroll students in one or more classes

## Step B: Teacher Operations

1. Login using faculty credentials.
2. Open **Teacher Portal**.
3. Start attendance session:
   - Choose class
   - Open facial attendance
4. System marks students as detected.
5. Teacher can also manually mark present/absent/late from roster.
6. End session to finalize save.

## Step C: Student View

1. Student logs in.
2. Student portal automatically shows:
   - Attendance trends
   - Enrolled courses
   - Grades

---

## 5) Attendance Data Flow (How reliability works)

- Face detection marks are sent to `/api/attendance/mark`.
- Manual marks also use `/api/attendance/mark`.
- Session end calls `/api/attendance/save-session`.
- Save-session now upserts attendance in SQLite for each student/class/date.
- Student portal reads from `/api/attendance/records` and refreshes periodically.

This provides consistent DB-backed attendance visibility across portals.

---

## 6) Helpful Commands

```bash
# Development
npm run dev

# Type-check / lint
npm run lint

# Production build
npm run build
npm run start
```

---

## 7) Troubleshooting

## App does not start

- Reinstall dependencies:
  - `rm -rf node_modules package-lock.json` (or delete manually on Windows)
  - `npm install`

## Face models not loading

- Confirm files exist under `public/models/`
- Hard refresh browser

## Camera not working

- Check browser camera permission
- Ensure no other app is locking webcam
- Try Chrome/Edge latest

## Attendance not appearing for student

- Ensure student is enrolled in class
- Ensure teacher ended/saved session
- Check API:
  - `/api/attendance/records?studentId=<studentId>`

## Faculty login failing

- Verify account was created in Admin -> Faculty
- Verify email/password exactly match saved values

---

## 8) Notes for Team Members

- This app currently relies on browser local state for some UI data and SQLite for backend records.
- If you run in a fresh environment, create initial data from Admin dashboard first.
- Keep `data/` writable on your machine for SQLite updates.

---

## 9) Repository

- Remote: [https://github.com/MirzaSajid/smart-classroom-system-.git](https://github.com/MirzaSajid/smart-classroom-system-.git)

