import { NextResponse } from "next/server"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { planId, userId, customerId, billingType } = body

    // Simulate a delay to mimic API call
    await new Promise((resolve) => setTimeout(resolve, 1500))

    // Mock response data
    const subscriptionId = `sub_${Date.now()}`
    const paymentId = `pay_${Date.now()}`

    return NextResponse.json({
      success: true,
      data: {
        subscriptionId,
        paymentId,
        status: "PENDING",
      },
    })
  } catch (error) {
    console.error("Error creating Asaas subscription:", error)
    return NextResponse.json(
      {
        success: false,
        message: "Erro ao criar assinatura",
      },
      { status: 500 },
    )
  }
}
