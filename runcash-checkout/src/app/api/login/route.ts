import { NextResponse } from "next/server"

// Mock user data for demonstration
const mockUsers = [
  {
    id: "user_1",
    username: "John Doe",
    email: "john@example.com",
    password: "password123", // In a real app, this would be hashed
    asaasCustomerId: "cus_000001",
  },
  {
    id: "user_2",
    username: "Jane Smith",
    email: "jane@example.com",
    password: "password123", // In a real app, this would be hashed
    asaasCustomerId: "cus_000002",
  },
]

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { email, password } = body

    // Simulate a small delay to mimic a real API call
    await new Promise((resolve) => setTimeout(resolve, 1000))

    // Find user by email
    const user = mockUsers.find((u) => u.email === email)

    // Check if user exists and password matches
    if (!user || user.password !== password) {
      return NextResponse.json({ message: "Email ou senha inválidos" }, { status: 401 })
    }

    // Create a mock token
    const token = `mock_token_${Date.now()}_${user.id}`

    // Return user data (excluding password) and token
    const { password: _, ...userWithoutPassword } = user

    return NextResponse.json({
      user: userWithoutPassword,
      token,
    })
  } catch (error) {
    console.error("Login error:", error)
    return NextResponse.json({ message: "Erro interno do servidor" }, { status: 500 })
  }
}
