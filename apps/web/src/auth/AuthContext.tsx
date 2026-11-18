import { useMemo, type ReactNode } from 'react'

import { useQuery, useQueryClient } from '@tanstack/react-query'

import { authApi } from '../api/mvp'
import { AuthContext, type AuthContextValue } from './auth-context'

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const currentUserQuery = useQuery({
    queryKey: ['mvp-current-user'],
    queryFn: () => authApi.getCurrentUser(),
    staleTime: Number.POSITIVE_INFINITY,
  })

  const value = useMemo<AuthContextValue>(
    () => ({
      user: currentUserQuery.data ?? null,
      isLoading: currentUserQuery.isPending,
      async login(identifier, password) {
        const session = await authApi.login(identifier, password)
        queryClient.setQueryData(['mvp-current-user'], session.user)
        return session
      },
      async logout() {
        await authApi.logout()
        queryClient.setQueryData(['mvp-current-user'], null)
      },
      requestRegistrationCode: (request) => authApi.requestRegistrationCode(request),
      async completeRegister(role, displayName) {
        const session = await authApi.register(role, displayName)
        queryClient.setQueryData(['mvp-current-user'], session.user)
        return session
      },
      requestPasswordReset: (identifier) => authApi.requestPasswordReset(identifier),
      verifyPasswordResetCode: (challengeId, code) =>
        authApi.verifyPasswordResetCode(challengeId, code),
      resetPassword: (challengeId, password) => authApi.resetPassword(challengeId, password),
    }),
    [currentUserQuery.data, currentUserQuery.isPending, queryClient],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
