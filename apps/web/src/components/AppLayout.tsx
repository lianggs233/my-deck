import { Box } from '@mantine/core'
import { Navigate, Outlet, useLocation } from 'react-router-dom'

import { useAuth } from '../auth/useAuth'
import type { UserRole } from '../types/domain'
import { homePath } from '../utils/home-path'
import { AppHeader } from './ui/AppHeader'

interface ProtectedRouteProps {
  allowedRole: UserRole
  children: React.ReactNode
}

export function ProtectedRoute({ allowedRole, children }: ProtectedRouteProps) {
  const { user, isLoading } = useAuth()
  const location = useLocation()

  if (isLoading) return null
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  if (user.role !== allowedRole) return <Navigate to={homePath(user.role)} replace />

  return <>{children}</>
}

/** 內頁版式：白頂欄 + Paper 內容區（寬 1312 置中） */
export function AppLayout() {
  const { user } = useAuth()

  if (!user) return <Navigate to="/login" replace />

  return (
    <Box component="main" mih="100vh" bg="#F5F8F6">
      <AppHeader />
      <Box component="div" className="md-container" py={48}>
        <Outlet />
      </Box>
    </Box>
  )
}
