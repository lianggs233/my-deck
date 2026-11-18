import { Navigate, Route, Routes } from 'react-router-dom'

import { AuthProvider } from './auth/AuthContext'
import { useAuth } from './auth/useAuth'
import { AppLayout, ProtectedRoute } from './components/AppLayout'
import { homePath } from './utils/home-path'
import { ForgotPasswordPage } from './pages/auth/ForgotPasswordPage'
import { LoginPage } from './pages/auth/LoginPage'
import { RegisterPage } from './pages/auth/RegisterPage'
import { RegisterVerifyPage } from './pages/auth/RegisterVerifyPage'
import { ResetPasswordPage } from './pages/auth/ResetPasswordPage'
import { ResetVerifyPage } from './pages/auth/ResetVerifyPage'
import { ProfilePage } from './pages/ProfilePage'
import { StatusPage } from './pages/StatusPage'
import { StudentCoursePage } from './pages/student/StudentCoursePage'
import { StudentCoursewarePreviewPage } from './pages/student/StudentCoursewarePreviewPage'
import { StudentHomePage } from './pages/student/StudentHomePage'
import { TeacherCoursePage } from './pages/teacher/TeacherCoursePage'
import { TeacherCoursewarePage } from './pages/teacher/TeacherCoursewarePage'
import { TeacherCoursewarePreviewPage } from './pages/teacher/TeacherCoursewarePreviewPage'
import { TeacherHomePage } from './pages/teacher/TeacherHomePage'

function RootRedirect() {
  const { user, isLoading } = useAuth()
  if (isLoading) return null
  return <Navigate to={user ? homePath(user.role) : '/login'} replace />
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/" element={<RootRedirect />} />
        <Route path="/status" element={<StatusPage />} />

        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/register/verify" element={<RegisterVerifyPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset/verify" element={<ResetVerifyPage />} />
        <Route path="/reset/password" element={<ResetPasswordPage />} />

        <Route
          element={
            <ProtectedRoute allowedRole="TEACHER">
              <AppLayout />
            </ProtectedRoute>
          }
        >
          <Route path="/teacher" element={<TeacherHomePage />} />
          <Route path="/teacher/profile" element={<ProfilePage />} />
          <Route path="/teacher/courses/:courseId" element={<TeacherCoursePage />} />
          <Route
            path="/teacher/courses/:courseId/courseware/:coursewareId"
            element={<TeacherCoursewarePage />}
          />
          <Route
            path="/teacher/courses/:courseId/courseware/:coursewareId/preview"
            element={<TeacherCoursewarePreviewPage />}
          />
        </Route>

        <Route
          element={
            <ProtectedRoute allowedRole="STUDENT">
              <AppLayout />
            </ProtectedRoute>
          }
        >
          <Route path="/student" element={<StudentHomePage />} />
          <Route path="/student/profile" element={<ProfilePage />} />
          <Route path="/student/courses/:courseId" element={<StudentCoursePage />} />
          <Route
            path="/student/courses/:courseId/courseware/:coursewareId"
            element={<StudentCoursewarePreviewPage />}
          />
        </Route>

        <Route path="*" element={<RootRedirect />} />
      </Routes>
    </AuthProvider>
  )
}
