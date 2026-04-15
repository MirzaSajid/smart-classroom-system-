function getMockAnomalies() {
  return {
    anomalies: [
      {
        id: "ANM001",
        type: "attendance",
        severity: "medium",
        description: "Unusual spike in absenteeism in Math classes on Mondays",
        confidence: 0.78,
        timestamp: new Date().toISOString(),
        action: "Review Monday schedule and student circumstances",
      },
      {
        id: "ANM002",
        type: "security",
        severity: "high",
        description: "Unauthorized access attempt detected at entrance B at 14:32",
        confidence: 0.92,
        timestamp: new Date().toISOString(),
        action: "Alert security team immediately",
      },
      {
        id: "ANM003",
        type: "behavior",
        severity: "low",
        description: "Student engagement decreased by 15% over past week",
        confidence: 0.65,
        timestamp: new Date().toISOString(),
        action: "Consider mentoring or support programs",
      },
    ],
  }
}

export async function POST(request: Request) {
  // Using mock data directly - AI Gateway requires credit card verification
  // To enable real AI, add credit card at: https://vercel.com/~/ai
  return Response.json(getMockAnomalies())
}
