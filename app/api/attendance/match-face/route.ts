import { NextRequest, NextResponse } from 'next/server'

interface StudentData {
  studentId: string
  studentName: string
  embedding?: number[]
}

interface MatchResult {
  matched: boolean
  studentId?: string
  studentName?: string
  confidence: number
  timestamp: string
}

const FACE_DISTANCE_THRESHOLD = 0.62
const FACE_AMBIGUITY_MARGIN = 0.02

export async function POST(request: NextRequest) {
  try {
    const { detectedEmbedding, studentDataset } = await request.json()

    if (!detectedEmbedding || !Array.isArray(studentDataset)) {
      console.log('[v0] Invalid request: missing embedding or dataset')
      return NextResponse.json(
        { matched: false, confidence: 0, timestamp: new Date().toISOString() },
        { status: 400 }
      )
    }

    console.log('[v0] Matching against', studentDataset.length, 'students')

    const candidates: Array<{ student: StudentData; distance: number; confidence: number }> = []

    for (const student of studentDataset) {
      if (!student.embedding) {
        console.log('[v0] Student', student.studentId, 'has no embedding')
        continue
      }

      // Compare face descriptors by Euclidean distance (lower = more similar).
      const distance = calculateEuclideanDistance(
        detectedEmbedding,
        student.embedding
      )
      const confidence = Math.max(0, Math.min(1, 1 - distance / FACE_DISTANCE_THRESHOLD))

      console.log('[v0] Match score for', student.studentName, ': distance', distance.toFixed(3), 'confidence', confidence.toFixed(3))
      candidates.push({ student, distance, confidence })
    }

    candidates.sort((a, b) => a.distance - b.distance)
    const best = candidates[0]
    const second = candidates[1]

    const withinDistance = !!best && best.distance <= FACE_DISTANCE_THRESHOLD
    const clearlyBest = !second || (second.distance - (best?.distance ?? 0)) >= FACE_AMBIGUITY_MARGIN

    const bestMatch: MatchResult =
      best && withinDistance && clearlyBest
        ? {
            matched: true,
            studentId: best.student.studentId,
            studentName: best.student.studentName,
            confidence: best.confidence,
            timestamp: new Date().toISOString(),
          }
        : {
            matched: false,
            confidence: best?.confidence ?? 0,
            timestamp: new Date().toISOString(),
          }

    if (bestMatch.matched) {
      console.log('[v0] Face matched to', bestMatch.studentName, 'with confidence', bestMatch.confidence.toFixed(3))
    } else {
      console.log('[v0] Unknown/ambiguous face; no confident match found')
    }

    return NextResponse.json(bestMatch)
  } catch (error) {
    console.error('[v0] Face matching error:', error)
    return NextResponse.json(
      { matched: false, confidence: 0, timestamp: new Date().toISOString() },
      { status: 500 }
    )
  }
}

function calculateEuclideanDistance(a: number[], b: number[]): number {
  if (a.length !== b.length) return Number.POSITIVE_INFINITY
  let sum = 0
  for (let i = 0; i < a.length; i++) {
    const d = a[i] - b[i]
    sum += d * d
  }
  return Math.sqrt(sum)
}
