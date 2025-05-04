import { NextResponse } from "next/server"

// Mock data for plans
const plans = [
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
  {
    id: "enterprise",
    name: "Plano Enterprise",
    type: "Anual",
    description: "Para empresas",
    price: 199.9,
    interval: "monthly",
    features: [
      "Todos os recursos do plano Premium",
      "Suporte 24/7",
      "API dedicada",
      "Gerenciamento de equipe",
      "Customizações exclusivas",
    ],
    allowedFeatures: [
      "basic_reports",
      "advanced_reports",
      "enterprise_support",
      "project_management",
      "premium_features",
      "team_management",
      "api_access",
      "custom_features",
    ],
  },
]

export async function GET() {
  // Simulate a small delay to mimic a real API call
  await new Promise((resolve) => setTimeout(resolve, 500))

  return NextResponse.json({ plans })
}
