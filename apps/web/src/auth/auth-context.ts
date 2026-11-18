import { createContext } from 'react'

import type { AuthSession, RegisterRequest, RegistrationChallenge, User } from '../types/domain'

export interface AuthContextValue {
  user: User | null
  isLoading: boolean
  login: (identifier: string, password: string) => Promise<AuthSession>
  logout: () => Promise<void>
  requestRegistrationCode: (request: RegisterRequest) => Promise<RegistrationChallenge>
  completeRegister: (role: RegisterRequest['role'], displayName: string) => Promise<AuthSession>
  requestPasswordReset: (identifier: string) => Promise<RegistrationChallenge>
  verifyPasswordResetCode: (challengeId: string, code: string) => Promise<void>
  resetPassword: (challengeId: string, password: string) => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)
