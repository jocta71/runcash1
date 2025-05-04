"use client"

import { createContext, useContext, type ReactNode, useState, useEffect } from "react"

interface User {
  id: string
  username: string
  email: string
  asaasCustomerId?: string
  // Add other user properties as needed
}

interface AuthContextType {
  user: User | null
  token: string | null
  login: (email: string, password: string) => Promise<void>
  logout: () => void
  isLoading: boolean
  error: string | null
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Check for existing session on mount
    const checkAuth = async () => {
      try {
        setIsLoading(true)
        // Get token from localStorage or cookies
        const savedToken = localStorage.getItem("auth_token")

        if (savedToken) {
          // Validate token and get user data
          // This is a placeholder - implement actual API call
          const userData = await fetchUserData(savedToken)
          setUser(userData)
          setToken(savedToken)
        }
      } catch (err: any) {
        console.error("Auth check failed:", err)
        setError(err.message)
        // Clear invalid session
        localStorage.removeItem("auth_token")
      } finally {
        setIsLoading(false)
      }
    }

    checkAuth()
  }, [])

  const login = async (email: string, password: string) => {
    try {
      setIsLoading(true)
      setError(null)

      // Placeholder for actual login API call
      const response = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || "Login failed")
      }

      setUser(data.user)
      setToken(data.token)

      // Save token
      localStorage.setItem("auth_token", data.token)

      return data
    } catch (err: any) {
      setError(err.message || "Login failed")
      throw err
    } finally {
      setIsLoading(false)
    }
  }

  const logout = () => {
    setUser(null)
    setToken(null)
    localStorage.removeItem("auth_token")
  }

  // Helper function to fetch user data
  const fetchUserData = async (token: string): Promise<User> => {
    // Placeholder for actual API call
    const response = await fetch("/api/me", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })

    if (!response.ok) {
      throw new Error("Failed to fetch user data")
    }

    return response.json()
  }

  return (
    <AuthContext.Provider value={{ user, token, login, logout, isLoading, error }}>{children}</AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}
