export interface UserSubscription {
  id: string
  userId: string
  planId: string
  planType: string
  startDate: Date
  status: string
  // Additional fields can be added here
}

export interface Plan {
  id: string
  name: string
  type: string
  description: string
  price: number
  interval: string
  features: string[]
  allowedFeatures: string[]
  // Additional fields can be added here
}

export interface User {
  id: string
  username: string
  email: string
  asaasCustomerId?: string
}
