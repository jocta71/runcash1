import { NextResponse } from "next/server"

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const paymentId = searchParams.get("paymentId")
    const force = searchParams.get("force") === "true"

    if (!paymentId) {
      return NextResponse.json(
        {
          success: false,
          message: "ID do pagamento é obrigatório",
        },
        { status: 400 },
      )
    }

    // Simulate a delay to mimic API call
    await new Promise((resolve) => setTimeout(resolve, 500))

    // For demo purposes, we'll simulate a payment that gets confirmed after a few checks
    // In a real app, this would check the actual payment status from Asaas
    const now = Date.now()
    const paymentCreationTime = Number.parseInt(paymentId.split("_")[1])
    const secondsSinceCreation = (now - paymentCreationTime) / 1000

    // After 10 seconds, consider the payment received
    let status = "PENDING"
    if (secondsSinceCreation > 10) {
      status = "RECEIVED"
    }

    return NextResponse.json({
      success: true,
      payment: {
        id: paymentId,
        status,
        value: 99.9,
        dueDate: new Date(now + 30 * 60 * 1000).toISOString(), // 30 minutes from now
        invoiceUrl: "https://example.com/invoice",
        billingType: "PIX",
      },
    })
  } catch (error) {
    console.error("Error finding Asaas payment:", error)
    return NextResponse.json(
      {
        success: false,
        message: "Erro ao buscar pagamento",
      },
      { status: 500 },
    )
  }
}
