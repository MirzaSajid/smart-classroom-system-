# Attendance (Face Recognition) — Working Settings

This doc captures the **known-good** settings/logic to keep the teacher “Start Attendance” camera flow working reliably across **refresh/back navigation**, while also ensuring **DB + Student Portal** updates work.

## Camera/video requirements (browser reliability)

- The `<video>` element should be:
  - `autoPlay`
  - `playsInline`
  - `muted` (**important**: improves autoplay reliability after refresh/back)
- Call `video.play()`:
  - right after attaching the stream (`video.srcObject = stream`)
  - again after metadata loads (and/or when playback starts)

Where this is implemented:
- `components/attendance/face-recognition-camera.tsx`

## Detection loop requirements (avoid “runs once” / “Last detect: —”)

- Only start detection when all are true:
  - `isActive === true`
  - `modelsReady === true`
  - `videoReady === true` (set from `onPlaying` when `videoWidth/videoHeight` are non-zero)
  - `studentDataset.length > 0` and embeddings exist
- Ensure the detection loop:
  - runs **immediately** once the session starts (`tick()`), then
  - continues on a timer (e.g. every ~1800ms)
- When capturing a frame:
  - ensure `canvas.width/height` match video dims before `drawImage()`

Where this is implemented:
- `components/attendance/face-recognition-camera.tsx`

## React state update rule (fix warning + keep marking working)

React warning that must be avoided:
- “Cannot update a component (`AttendanceSession`) while rendering a different component (`FaceRecognitionCamera`).”

Rule:
- Do **not** call parent state updates from inside another component’s render/state-updater path.

Implementation detail:
- When adding fresh detections inside `setDetectedStudents(prev => ...)`, defer side-effects like marking:
  - use `queueMicrotask(() => tryMarkStudent(...))` (or `setTimeout(..., 0)`), so it runs after React completes the state update.

Where this is implemented:
- `components/attendance/face-recognition-camera.tsx`

## Database + Student Portal “source of truth”

Problem:
- `localStorage.attendanceRecords` only updates in the *current browser/profile/device* (teacher machine), so students won’t see updates.

Fix:
- Write attendance to DB via:
  - `POST /api/attendance/mark`
- Read attendance from DB via:
  - `GET /api/attendance/records?studentId=...`
- Student portal should fetch from DB (and may fallback to localStorage for dev/demo).

Where this is implemented:
- `app/api/attendance/mark/route.ts`
- `app/api/attendance/records/route.ts`
- `components/dashboards/student-portal.tsx`

## Teacher “Start Attendance” launches Python (desktop) attendance

When the teacher starts an attendance session, the UI can start/stop the Python webcam attendance program on the same machine running the Next.js server:

- API:
  - `POST /api/attendance/python` with `{ action: "start" | "stop", classId, className }`
- Process manager:
  - single-process spawn/kill logic in Node runtime

Where this is implemented:
- `app/api/attendance/python/route.ts`
- `lib/python-attendance.ts`
- `components/attendance/attendance-session.tsx`

