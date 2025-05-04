import { NextResponse } from "next/server"

// Mock subscription data
const mockSubscriptions = [
  {
    id: "sub_1",
    userId: "user_1",
    planId: "premium",
    planType: "Mensal",
    startDate: new Date("2023-01-01"),
    status: "active",
  },
  {
    id: "sub_2",
    userId: "user_2",
    planId: "basic",
    planType: "Mensal",
    startDate: new Date("2023-02-15"),
    status: "active",
  },
]

export async function GET(request: Request) {
  try {
    // Get the Authorization header
    const authHeader = request.headers.get("Authorization")

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ message: "Não autorizado" }, { status: 401 })
    }

    const token = authHeader.split(" ")[1]

    // In a real app, you would validate the token
    // For this mock, we'll extract the user ID from the token
    const userIdMatch = token.match(/mock_token_\d+_(.+)/)

    if (!userIdMatch) {
      return NextResponse.json({ message: "Token inválido" }, { status: 401 })
    }

    const userId = userIdMatch[1]

    // Find the subscription for this user
    const subscription = mockSubscriptions.find((s) => s.userId === userId)

    // Simulate a small delay to mimic a real API call
    await new Promise((resolve) => setTimeout(resolve, 500))

    return NextResponse.json({ subscription })
  } catch (error) {
    console.error("Get subscription error:", error)
    return NextResponse.json({ message: "Erro interno do servidor" }, { status: 500 })
  }
}
