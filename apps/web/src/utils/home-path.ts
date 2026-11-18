import type { UserRole } from '../types/domain'

export function homePath(role: UserRole) {
  return role === 'TEACHER' ? '/teacher' : '/student'
}
