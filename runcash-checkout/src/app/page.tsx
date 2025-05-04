"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
import { Check, Copy, Loader2, RefreshCw } from "lucide-react"
import Image from "next/image"

// Form schema for validation
const formSchema = z.object({
  name: z.string().min(3, { message: "Nome completo é obrigatório" }),
  email: z.string().email({ message: "E-mail inválido" }),
  cpf: z.string().min(11, { message: "CPF inválido" }),
  phone: z.string().optional(),
})

type FormData = z.infer<typeof formSchema>

// Checkout states
type CheckoutState =
  | "FORM_INPUT"
  | "VALIDATING"
  | "PROCESSING_PAYMENT"
  | "WAITING_PAYMENT"
  | "PAYMENT_RECEIVED"
  | "ERROR"

// Mock user data
const mockUser = {
  id: "user_demo",
  username: "Demo User",
  email: "demo@example.com",
  asaasCustomerId: "cus_demo",
}

// Mock plan data
const mockPlans = [
  {
    id: "basic",
    name: "Plano Básico",
    type: "Mensal",
    description: "Ideal para iniciantes",
    price: 49.9,
    interval: "monthly",
    features: ["Acesso a recursos básicos", "Suporte por email", "Até 3 projetos", "Relatórios mensais"],
    allowedFeatures: ["basic_reports", "email_support", "project_management"],
  },
  {
    id: "premium",
    name: "Plano Premium",
    type: "Mensal",
    description: "Para usuários avançados",
    price: 99.9,
    interval: "monthly",
    features: [
      "Todos os recursos do plano Básico",
      "Suporte prioritário",
      "Projetos ilimitados",
      "Relatórios avançados",
      "Acesso a recursos premium",
    ],
    allowedFeatures: [
      "basic_reports",
      "advanced_reports",
      "priority_support",
      "project_management",
      "premium_features",
    ],
  },
]

export default function CheckoutPage() {
  const router = useRouter()
  const [checkoutState, setCheckoutState] = useState<CheckoutState>("FORM_INPUT")
  const [selectedPlan, setSelectedPlan] = useState<any>(null)
  const [paymentData, setPaymentData] = useState<{
    subscriptionId?: string
    paymentId?: string
    pixCode?: string
    pixImageUrl?: string
    expirationTime?: Date
  }>({})
  const [error, setError] = useState<string | null>(null)
  const [progress, setProgress] = useState(25)
  const [isLoading, setIsLoading] = useState(true)
  const [copied, setCopied] = useState(false)
  const [timeLeft, setTimeLeft] = useState<string>("")

  // Initialize form
  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: mockUser.username || "",
      email: mockUser.email || "",
      cpf: "",
      phone: "",
    },
  })

  // Get plan from URL or use default
  useEffect(() => {
    const fetchPlans = async () => {
      setIsLoading(true)
      try {
        // In a real app, this would be an API call
        // For now, we'll use the mock data
        setTimeout(() => {
          const urlParams = new URLSearchParams(window.location.search)
          const planId = urlParams.get("planId")

          if (planId) {
            const plan = mockPlans.find((p) => p.id === planId)
            if (plan) {
              setSelectedPlan(plan)
            } else {
              setSelectedPlan(mockPlans[0])
            }
          } else {
            setSelectedPlan(mockPlans[0])
          }
          setIsLoading(false)
        }, 500)
      } catch (err) {
        console.error("Error fetching plans:", err)
        setError("Erro ao carregar planos")
        setIsLoading(false)
      }
    }

    fetchPlans()
  }, [])

  // Calculate time left for payment
  useEffect(() => {
    if (!paymentData.expirationTime) return

    const calculateTimeLeft = () => {
      const now = new Date()
      const difference = paymentData.expirationTime!.getTime() - now.getTime()

      if (difference <= 0) {
        setTimeLeft("Expirado")
        return
      }

      const minutes = Math.floor((difference / 1000 / 60) % 60)
      const seconds = Math.floor((difference / 1000) % 60)

      setTimeLeft(`${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`)
    }

    calculateTimeLeft()
    const timer = setInterval(calculateTimeLeft, 1000)

    return () => clearInterval(timer)
  }, [paymentData.expirationTime])

  // Poll for payment status
  useEffect(() => {
    let interval: NodeJS.Timeout

    if (checkoutState === "WAITING_PAYMENT" && paymentData.paymentId) {
      interval = setInterval(async () => {
        try {
          // Simulate payment check
          const now = Date.now()
          const paymentCreationTime = Number.parseInt(paymentData.paymentId!.split("_")[1])
          const secondsSinceCreation = (now - paymentCreationTime) / 1000

          // After 10 seconds, consider the payment received
          if (secondsSinceCreation > 10) {
            clearInterval(interval)
            setCheckoutState("PAYMENT_RECEIVED")
            setTimeout(() => {
              router.push("/payment-success")
            }, 2000)
          }
        } catch (err) {
          console.error("Error checking payment status:", err)
        }
      }, 5000) // Check every 5 seconds
    }

    return () => {
      if (interval) clearInterval(interval)
    }
  }, [checkoutState, paymentData.paymentId, router])

  // Update progress based on state
  useEffect(() => {
    switch (checkoutState) {
      case "FORM_INPUT":
        setProgress(25)
        break
      case "VALIDATING":
      case "PROCESSING_PAYMENT":
        setProgress(50)
        break
      case "WAITING_PAYMENT":
        setProgress(75)
        break
      case "PAYMENT_RECEIVED":
        setProgress(100)
        break
      default:
        setProgress(25)
    }
  }, [checkoutState])

  const handleSubmit = async (data: FormData) => {
    if (!selectedPlan) {
      setError("Dados do plano não encontrados")
      return
    }

    try {
      setCheckoutState("VALIDATING")

      // Validation passed, proceed to payment
      setCheckoutState("PROCESSING_PAYMENT")

      // Simulate API delay
      await new Promise((resolve) => setTimeout(resolve, 1500))

      // Mock payment data
      const paymentId = `pay_${Date.now()}`

      // Set payment data
      setPaymentData({
        subscriptionId: `sub_${Date.now()}`,
        paymentId,
        pixCode:
          "00020101021226880014br.gov.bcb.pix2566qrcodes-pix.asaas.com/emv/8C3B7F6A9E0B4E4FBF9E2D25E4D9B3A8F5000.005802BR5925ASAAS PAGAMENTOS LTDA6009SAO PAULO62070503***6304E2CA",
        pixImageUrl:
          "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
        expirationTime: new Date(Date.now() + 30 * 60 * 1000), // 30 minutes from now
      })

      setCheckoutState("WAITING_PAYMENT")
    } catch (err: any) {
      console.error("Checkout error:", err)
      setError(err.message || "Ocorreu um erro durante o checkout")
      setCheckoutState("ERROR")
    }
  }

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(paymentData.pixCode || "")
      setCopied(true)
      setTimeout(() => setCopied(false), 3000)
    } catch (err) {
      console.error("Failed to copy:", err)
    }
  }

  const handleRetry = () => {
    setError(null)
    setCheckoutState("FORM_INPUT")
  }

  const handleCancel = () => {
    router.push("/")
  }

  // Format price
  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(price)
  }

  // Format interval
  const formatInterval = (interval: string) => {
    switch (interval.toLowerCase()) {
      case "monthly":
        return "mês"
      case "yearly":
        return "ano"
      case "weekly":
        return "semana"
      default:
        return interval
    }
  }

  // Render checkout form
  const renderCheckoutForm = () => {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-semibold mb-4">Dados pessoais</h2>
          <p className="text-sm text-muted-foreground mb-6">Preencha seus dados para finalizar a assinatura</p>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome completo</FormLabel>
                  <FormControl>
                    <Input placeholder="Digite seu nome completo" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>E-mail</FormLabel>
                  <FormControl>
                    <Input type="email" placeholder="seu@email.com" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="cpf"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>CPF</FormLabel>
                  <FormControl>
                    <Input placeholder="123.456.789-00" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Telefone (opcional)</FormLabel>
                  <FormControl>
                    <Input placeholder="(11) 98765-4321" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="pt-4">
              <Button type="submit" className="w-full h-12 text-base" disabled={checkoutState === "VALIDATING"}>
                {checkoutState === "VALIDATING" ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processando...
                  </>
                ) : (
                  "Continuar para pagamento"
                )}
              </Button>
            </div>
          </form>
        </Form>
      </div>
    )
  }

  // Render payment summary
  const renderPaymentSummary = () => {
    if (!selectedPlan) return null

    return (
      <Card className="border-0 bg-black/20 backdrop-blur-sm">
        <CardHeader className="pb-3">
          <h3 className="text-xl font-semibold">Resumo da assinatura</h3>
        </CardHeader>
        <CardContent className="pb-3">
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h4 className="font-medium">{selectedPlan.name}</h4>
                <p className="text-sm text-muted-foreground">Plano {selectedPlan.type}</p>
              </div>
              <div className="text-right">
                <div className="font-semibold">{formatPrice(selectedPlan.price)}</div>
                <div className="text-sm text-muted-foreground">por {formatInterval(selectedPlan.interval)}</div>
              </div>
            </div>

            <Separator />

            <div className="space-y-2">
              <h4 className="font-medium">O que está incluído:</h4>
              <ul className="space-y-2">
                {selectedPlan.features.map((feature: string, index: number) => (
                  <li key={index} className="flex items-start gap-2">
                    <Check className="h-5 w-5 text-green-500 shrink-0 mt-0.5" />
                    <span className="text-sm">{feature}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </CardContent>
        <CardFooter className="border-t border-border pt-4">
          <div className="w-full flex justify-between items-center">
            <span className="font-medium">Total</span>
            <div className="text-right">
              <div className="text-xl font-bold">{formatPrice(selectedPlan.price)}</div>
              <div className="text-sm text-muted-foreground">Pagamento via PIX</div>
            </div>
          </div>
        </CardFooter>
      </Card>
    )
  }

  // Render PIX payment
  const renderPixPayment = () => {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-semibold mb-2">Pagamento via PIX</h2>
          <p className="text-sm text-muted-foreground">
            Escaneie o QR Code abaixo ou copie o código PIX para realizar o pagamento
          </p>
        </div>

        <Card className="p-6 flex flex-col items-center justify-center bg-black/20 backdrop-blur-sm border-0">
          {/* QR Code */}
          <div className="bg-white p-4 rounded-lg mb-4">
            {paymentData.pixImageUrl ? (
              <Image
                src={paymentData.pixImageUrl || "/placeholder.svg"}
                alt="QR Code PIX"
                width={200}
                height={200}
                className="mx-auto"
              />
            ) : (
              <div className="w-[200px] h-[200px] bg-gray-200 animate-pulse rounded-md flex items-center justify-center">
                <RefreshCw className="h-8 w-8 text-gray-400 animate-spin" />
              </div>
            )}
          </div>

          {/* Timer */}
          {paymentData.expirationTime && (
            <div className="mb-4 text-center">
              <p className="text-sm text-muted-foreground mb-1">Tempo restante para pagamento:</p>
              <div className="text-xl font-mono font-bold">{timeLeft}</div>
            </div>
          )}

          {/* Copy button */}
          <div className="w-full">
            <Button
              onClick={copyToClipboard}
              className="w-full flex items-center justify-center gap-2 h-12"
              variant={copied ? "outline" : "default"}
            >
              {copied ? (
                <>
                  <Check className="h-4 w-4" />
                  Código copiado!
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4" />
                  Copiar código PIX
                </>
              )}
            </Button>
          </div>
        </Card>

        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4">
          <h3 className="text-sm font-medium text-yellow-500 mb-2">Importante</h3>
          <p className="text-xs text-muted-foreground">
            Após o pagamento, aguarde alguns instantes para a confirmação automática. Não feche esta página até a
            confirmação do pagamento.
          </p>
        </div>
      </div>
    )
  }

  // Render different components based on checkout state
  const renderCheckoutStep = () => {
    switch (checkoutState) {
      case "FORM_INPUT":
      case "VALIDATING":
        return (
          <div className="grid md:grid-cols-2 gap-8">
            {renderCheckoutForm()}
            {renderPaymentSummary()}
          </div>
        )

      case "PROCESSING_PAYMENT":
        return (
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
            <h2 className="text-2xl font-bold mb-2">Processando pagamento</h2>
            <p className="text-muted-foreground">Estamos preparando seu pagamento, aguarde um momento...</p>
          </div>
        )

      case "WAITING_PAYMENT":
        return (
          <div className="grid md:grid-cols-2 gap-8">
            {renderPixPayment()}
            {renderPaymentSummary()}
          </div>
        )

      case "PAYMENT_RECEIVED":
        return (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mb-4">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-8 w-8 text-white"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold mb-2">Pagamento confirmado!</h2>
            <p className="text-muted-foreground mb-6">Seu pagamento foi processado com sucesso.</p>
            <p className="text-sm text-muted-foreground">Redirecionando para a página de sucesso...</p>
          </div>
        )

      case "ERROR":
        return (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="w-16 h-16 bg-red-500 rounded-full flex items-center justify-center mb-4">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-8 w-8 text-white"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold mb-2">Ocorreu um erro</h2>
            <p className="text-muted-foreground mb-6">{error || "Não foi possível processar seu pagamento."}</p>
            <div className="flex gap-4">
              <button
                onClick={handleRetry}
                className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90 transition-colors"
              >
                Tentar novamente
              </button>
              <button
                onClick={handleCancel}
                className="px-4 py-2 border border-input bg-background rounded-md hover:bg-accent hover:text-accent-foreground transition-colors"
              >
                Voltar para planos
              </button>
            </div>
          </div>
        )

      default:
        return null
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p>Carregando informações do plano...</p>
        </div>
      </div>
    )
  }

  if (!selectedPlan) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <p className="text-red-500 mb-4">Erro ao carregar plano</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90 transition-colors"
          >
            Tentar novamente
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="container max-w-6xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8 text-center">Finalizar assinatura</h1>

      {/* Progress indicator */}
      <div className="mb-8 max-w-md mx-auto">
        <Progress value={progress} className="h-2" />
        <div className="flex justify-between mt-2 text-sm text-muted-foreground">
          <span>Dados</span>
          <span>Pagamento</span>
          <span>Confirmação</span>
        </div>
      </div>

      {/* Main content */}
      <div className="bg-vegas-black rounded-xl p-6 md:p-8 shadow-lg">{renderCheckoutStep()}</div>
    </div>
  )
}
