import { lazy, Suspense } from 'react'
import { AuthProvider } from './auth/AuthContext'
import { useAuth } from './auth/session'
import { LoginPage } from './pages/login/LoginPage'

const HomePage = lazy(() => import('./pages/home/HomePage').then((m) => ({ default: m.HomePage })))

function Root() {
  const { user } = useAuth()
  if (!user) return <LoginPage />
  return (
    <Suspense fallback={null}>
      <HomePage />
    </Suspense>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <Root />
    </AuthProvider>
  )
}
