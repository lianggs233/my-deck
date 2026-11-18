import { createContext } from 'react'

import type { AuthSession, RegisterRequest, RegistrationChallenge, User } from '../types/domain'

export interface AuthContextValue {
  user: User | null
  isLoading: boolean
  login: (identifier: string, password: string) => Promise<AuthSession>
  logout: () => Promise<void>
  /** 免驗證碼註冊；成功後回登入頁重新登入 */
  register: (request: RegisterRequest) => Promise<void>
  requestPasswordReset: (identifier: string) => Promise<RegistrationChallenge>
  verifyPasswordResetCode: (challengeId: string, code: string) => Promise<void>
  resetPassword: (challengeId: string, code: string, password: string) => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)
