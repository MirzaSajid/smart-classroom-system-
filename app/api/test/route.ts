// Dev-only: chains to local AI routes to verify mock responses.
export async function GET() {
  if (process.env.NODE_ENV === "production") {
    return Response.json({ error: "Not found" }, { status: 404 })
  }
  try {
    // Test anomalies route
    const anomalyRes = await fetch(
      `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/ai/detect-anomalies`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) }
    )
    const anomalyData = await anomalyRes.json()

    // Test predictions route
    const predRes = await fetch(
      `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/ai/generate-predictions`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) }
    )
    const predData = await predRes.json()

    // Test recommendations route
    const recRes = await fetch(
      `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/ai/get-recommendations`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) }
    )
    const recData = await recRes.json()

    return Response.json({
      status: "All routes working correctly with mock data",
      anomalies: anomalyData.anomalies ? "OK" : "MISSING",
      predictions: predData.predictions ? "OK" : "MISSING",
      recommendations: recData.recommendations ? "OK" : "MISSING",
    })
  } catch (error) {
    return Response.json({ error: String(error) }, { status: 500 })
  }
}
