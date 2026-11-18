import { useMemo, type ReactNode } from 'react'

import { useQuery, useQueryClient } from '@tanstack/react-query'

import { authApi } from '../api/mvp'
import { AuthContext, type AuthContextValue } from './auth-context'

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const currentUserQuery = useQuery({
    queryKey: ['current-user'],
    queryFn: () => authApi.getCurrentUser(),
    staleTime: Number.POSITIVE_INFINITY,
  })

  const value = useMemo<AuthContextValue>(
    () => ({
      user: currentUserQuery.data ?? null,
      isLoading: currentUserQuery.isPending,
      async login(identifier, password) {
        const session = await authApi.login(identifier, password)
        queryClient.setQueryData(['current-user'], session.user)
        return session
      },
      async logout() {
        await authApi.logout()
        queryClient.setQueryData(['current-user'], null)
      },
      async register(request) {
        await authApi.register(request)
      },
      resetPasswordDirect: (identifier, oldPassword, newPassword) =>
        authApi.resetPasswordDirect(identifier, oldPassword, newPassword),
    }),
    [currentUserQuery.data, currentUserQuery.isPending, queryClient],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
