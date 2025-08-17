"use client"

import { createContext, useContext, useState, type ReactNode } from "react"

export type VerificationStatus = "pending" | "verified" | "rejected"

interface VerificationContextType {
  status: VerificationStatus
   isVerified: boolean;         
  setStatus: (status: VerificationStatus) => void
}

const VerificationContext = createContext<VerificationContextType | undefined>(undefined)

interface VerificationProviderProps {
  children: ReactNode
  initialStatus?: VerificationStatus
}

export function VerificationProvider({ children, initialStatus = "verified" }: VerificationProviderProps) {
  const [status, setStatus] = useState<VerificationStatus>(initialStatus)

  const value: VerificationContextType = {
    status,
     isVerified: status === "verified",
    setStatus,
  }

  return <VerificationContext.Provider value={value}>{children}</VerificationContext.Provider>
}

export function useVerification() {
  const context = useContext(VerificationContext)
  if (context === undefined) {
    throw new Error("useVerification must be used within a VerificationProvider")
  }
  return context
}
