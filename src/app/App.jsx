import { AppProviders } from '@/app/providers/AppProviders'
import { AppRoutes } from '@/app/routes/index'

export default function App() {
  return (
    <AppProviders>
      <AppRoutes />
    </AppProviders>
  )
}
