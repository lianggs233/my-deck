import { createContext } from 'react'

import type { AuthSession, RegisterRequest, User } from '../types/domain'

export interface AuthContextValue {
  user: User | null
  isLoading: boolean
  login: (identifier: string, password: string) => Promise<AuthSession>
  logout: () => Promise<void>
  /** 免驗證碼註冊；成功後回登入頁重新登入 */
  register: (request: RegisterRequest) => Promise<void>
  /** 本期忘記密碼流程：舊密碼驗證直接重設（不發驗證碼） */
  resetPasswordDirect: (
    identifier: string,
    oldPassword: string,
    newPassword: string,
  ) => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)
