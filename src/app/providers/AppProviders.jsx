import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from '../../context/AuthProvider.jsx'
import { ToastProvider } from '../../components/feedback/ToastProvider.jsx'
import { ErrorBoundary } from '../../components/feedback/ErrorBoundary.jsx'

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
