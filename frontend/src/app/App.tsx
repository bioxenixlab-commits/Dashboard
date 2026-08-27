import { AuthProvider } from '@/hooks/useAuth'
import { AppRoutes } from './AppRoutes'

export function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  )
}

export default App