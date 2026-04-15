function getMockPredictions() {
  return {
    predictions: [
      {
        id: "PRED001",
        title: "High Absence Rate Expected",
        probability: 0.85,
        timeframe: "Next 7 days",
        impact: "high",
        recommendation: "Prepare staff support and consider makeup sessions",
      },
      {
        id: "PRED002",
        title: "Security Alert: Peak Hours Approaching",
        probability: 0.72,
        timeframe: "Next 24 hours",
        impact: "medium",
        recommendation: "Increase security presence during peak hours",
      },
      {
        id: "PRED003",
        title: "Student Engagement Decline Risk",
        probability: 0.68,
        timeframe: "Next 14 days",
        impact: "medium",
        recommendation: "Initiate engagement programs and teacher check-ins",
      },
    ],
  }
}

export async function POST(request: Request) {
  // Using mock data directly - AI Gateway requires credit card verification
  // To enable real AI, add credit card at: https://vercel.com/~/ai
  return Response.json(getMockPredictions())
}
