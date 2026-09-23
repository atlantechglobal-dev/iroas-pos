import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from '@/shared/context/AuthProvider'
import { ToastProvider } from '@/shared/ui/feedback/ToastProvider'
import { ErrorBoundary } from '@/shared/ui/feedback/ErrorBoundary'

export function AppProviders({ children }) {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <ToastProvider>{children}</ToastProvider>
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  )
}
