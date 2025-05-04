"use client"
import { useRouter } from "next/navigation"
import { CheckCircle } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function PaymentSuccessPage() {
  const router = useRouter()

  return (
    <div className="container max-w-md mx-auto px-4 py-16">
      <div className="bg-vegas-black rounded-xl p-8 shadow-lg text-center">
        <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-6">
          <CheckCircle className="h-10 w-10 text-white" />
        </div>

        <h1 className="text-2xl font-bold mb-4">Pagamento confirmado!</h1>

        <p className="text-muted-foreground mb-8">
          Sua assinatura foi ativada com sucesso. Agora você tem acesso a todos os recursos do seu plano.
        </p>

        <div className="space-y-4">
          <Button onClick={() => router.push("/dashboard")} className="w-full">
            Ir para o Dashboard
          </Button>

          <Button variant="outline" onClick={() => router.push("/")} className="w-full">
            Voltar para a página inicial
          </Button>
        </div>
      </div>
    </div>
  )
}
