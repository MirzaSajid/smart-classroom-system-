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

    // Find best match from student dataset
    let bestMatch: MatchResult = {
      matched: false,
      confidence: 0,
      timestamp: new Date().toISOString(),
    }

    for (const student of studentDataset) {
      if (!student.embedding) {
        console.log('[v0] Student', student.studentId, 'has no embedding')
        continue
      }

      // Calculate similarity (cosine similarity)
      const similarity = calculateCosineSimilarity(
        detectedEmbedding,
        student.embedding
      )

      console.log('[v0] Match score for', student.studentName, ':', similarity.toFixed(3))

      // Confidence threshold: 0.6
      if (similarity > 0.6 && similarity > bestMatch.confidence) {
        bestMatch = {
          matched: true,
          studentId: student.studentId,
          studentName: student.studentName,
          confidence: similarity,
          timestamp: new Date().toISOString(),
        }
      }
    }

    if (bestMatch.matched) {
      console.log('[v0] Face matched to', bestMatch.studentName, 'with confidence', bestMatch.confidence.toFixed(3))
    } else {
      console.log('[v0] No matching face found (threshold: 0.6)')
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

function calculateCosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0

  let dotProduct = 0
  let normA = 0
  let normB = 0

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB)
  return denominator === 0 ? 0 : dotProduct / denominator
}
