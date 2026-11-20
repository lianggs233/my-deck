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

/** 內頁版式：白頂欄 + Paper 內容區（填滿寬度，邊緣留白 2rem） */
export function AppLayout() {
  const { user } = useAuth()

  if (!user) return <Navigate to="/login" replace />

  return (
    <Box
      component="main"
      className="md-viewport"
      bg="#F5F8F6"
      style={{ display: 'flex', flexDirection: 'column' }}
    >
      <AppHeader />
      <Box component="div" style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
        <Box className="md-container" py={32}>
          <Outlet />
        </Box>
      </Box>
    </Box>
  )
}
