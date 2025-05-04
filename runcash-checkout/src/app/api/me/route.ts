import { NextResponse } from "next/server"

// Mock user data for demonstration
const mockUsers = [
  {
    id: "user_1",
    username: "John Doe",
    email: "john@example.com",
    asaasCustomerId: "cus_000001",
  },
  {
    id: "user_2",
    username: "Jane Smith",
    email: "jane@example.com",
    asaasCustomerId: "cus_000002",
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

    // Find the user by ID
    const user = mockUsers.find((u) => u.id === userId)

    if (!user) {
      return NextResponse.json({ message: "Usuário não encontrado" }, { status: 404 })
    }

    // Return the user data
    return NextResponse.json(user)
  } catch (error) {
    console.error("Get user error:", error)
    return NextResponse.json({ message: "Erro interno do servidor" }, { status: 500 })
  }
}
