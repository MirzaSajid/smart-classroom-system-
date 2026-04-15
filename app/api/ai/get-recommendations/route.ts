function getMockRecommendations() {
  return {
    recommendations: [
      {
        id: "REC001",
        category: "Attendance",
        suggestion: "Implement weekly engagement workshops to improve attendance rates",
        expectedBenefit: "Expected 12-15% improvement in attendance within 4 weeks",
        priority: "high",
      },
      {
        id: "REC002",
        category: "Security",
        suggestion: "Deploy additional security cameras in high-traffic areas",
        expectedBenefit: "Enhanced real-time monitoring and incident prevention",
        priority: "high",
      },
      {
        id: "REC003",
        category: "Engagement",
        suggestion: "Launch peer mentoring program for at-risk students",
        expectedBenefit: "Improved student retention and academic performance",
        priority: "medium",
      },
      {
        id: "REC004",
        category: "Operations",
        suggestion: "Use AI-driven early warning system for chronic absentees",
        expectedBenefit: "Proactive intervention before attendance crisis develops",
        priority: "medium",
      },
    ],
  }
}

export async function POST(request: Request) {
  // Using mock data directly - AI Gateway requires credit card verification
  // To enable real AI, add credit card at: https://vercel.com/~/ai
  return Response.json(getMockRecommendations())
}
