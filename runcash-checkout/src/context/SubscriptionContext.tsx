"use client"

import { createContext, useContext, type ReactNode, useState, useEffect } from "react"
import { useAuth } from "@/context/AuthContext"
import type { Plan, UserSubscription } from "@/types/plans"

interface SubscriptionContextType {
  currentSubscription: UserSubscription | null
  availablePlans: Plan[] | null
  isLoading: boolean
  error: string | null
  hasFeatureAccess: (featureKey: string) => boolean
  refreshSubscription: () => Promise<void>
}

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined)

export function SubscriptionProvider({ children }: { children: ReactNode }) {
  const { user, token } = useAuth()
  const [currentSubscription, setCurrentSubscription] = useState<UserSubscription | null>(null)
  const [availablePlans, setAvailablePlans] = useState<Plan[] | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  // Fetch subscription data when user or token changes
  useEffect(() => {
    if (user && token) {
      fetchSubscriptionData()
      fetchAvailablePlans()
    } else {
      setCurrentSubscription(null)
    }
  }, [user, token])

  const fetchSubscriptionData = async () => {
    if (!token) return

    try {
      setIsLoading(true)
      setError(null)

      // Placeholder for actual API call
      const response = await fetch("/api/subscription", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (!response.ok) {
        throw new Error("Failed to fetch subscription data")
      }

      const data = await response.json()
      setCurrentSubscription(data.subscription)
    } catch (err: any) {
      console.error("Subscription fetch error:", err)
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }

  const fetchAvailablePlans = async () => {
    try {
      // Placeholder for actual API call
      const response = await fetch("/api/plans")

      if (!response.ok) {
        throw new Error("Failed to fetch available plans")
      }

      const data = await response.json()
      setAvailablePlans(data.plans)
    } catch (err: any) {
      console.error("Plans fetch error:", err)
      setError(err.message)
    }
  }

  const refreshSubscription = async () => {
    return fetchSubscriptionData()
  }

  const hasFeatureAccess = (featureKey: string): boolean => {
    if (!currentSubscription || !availablePlans) return false

    // Find the current plan
    const currentPlan = availablePlans.find((plan) => plan.id === currentSubscription.planId)

    if (!currentPlan) return false

    // Check if the feature is allowed in the current plan
    return currentPlan.allowedFeatures.includes(featureKey)
  }

  return (
    <SubscriptionContext.Provider
      value={{
        currentSubscription,
        availablePlans,
        isLoading,
        error,
        hasFeatureAccess,
        refreshSubscription,
      }}
    >
      {children}
    </SubscriptionContext.Provider>
  )
}

export function useSubscription() {
  const context = useContext(SubscriptionContext)
  if (context === undefined) {
    throw new Error("useSubscription must be used within a SubscriptionProvider")
  }
  return context
}
