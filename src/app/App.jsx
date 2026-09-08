import { AppProviders } from './providers/AppProviders.jsx'
import { AppRoutes } from './routes/index.jsx'

export default function App() {
  return (
    <AppProviders>
      <AppRoutes />
    </AppProviders>
  )
}
