import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'

import ProtectedRoute from './components/ProtectedRoute'

import Login from './pages/Login/Login'
import ForgotPassword from './pages/ForgotPassword/ForgotPassword'
import AccountRecovery from './pages/AccountRecovery/AccountRecovery'
import NewPassword from './pages/NewPassword/NewPassword'
import PasswordUpdated from './pages/PasswordUpdated/PasswordUpdated'
import CreateAccount from './pages/CreateAccount/CreateAccount'
import RestaurantSetup from './pages/RestaurantSetup/RestaurantSetup'
import Domain from './pages/Domain/Domain'
import Brand from './pages/Brand/Brand'
import Launch from './pages/Launch/Launch'
import GoLive from './pages/GoLive/GoLive'
import DirectoryListings from './pages/DirectoryListings/DirectoryListings'
import DigitalBusinessCard from './pages/DigitalBusinessCard/DigitalBusinessCard'
import OneLink from './pages/OneLink/OneLink'
import PlatformAdmin from './pages/PlatformAdmin/PlatformAdmin'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />

        {/* Public */}
        <Route path="/login" element={<Login />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/account-recovery" element={<AccountRecovery />} />
        <Route path="/new-password" element={<NewPassword />} />
        <Route path="/password-updated" element={<PasswordUpdated />} />
        <Route path="/create-account" element={<CreateAccount />} />

        {/* Owner onboarding + dashboard */}
        <Route
          path="/restaurant-setup"
          element={
            <ProtectedRoute>
              <RestaurantSetup />
            </ProtectedRoute>
          }
        />
        <Route
          path="/domain"
          element={
            <ProtectedRoute>
              <Domain />
            </ProtectedRoute>
          }
        />
        <Route
          path="/brand"
          element={
            <ProtectedRoute>
              <Brand />
            </ProtectedRoute>
          }
        />
        <Route
          path="/launch"
          element={
            <ProtectedRoute>
              <Launch />
            </ProtectedRoute>
          }
        />
        <Route
          path="/go-live"
          element={
            <ProtectedRoute>
              <GoLive />
            </ProtectedRoute>
          }
        />
        <Route
          path="/directory-listings"
          element={
            <ProtectedRoute>
              <DirectoryListings />
            </ProtectedRoute>
          }
        />
        <Route
          path="/digital-business-card"
          element={
            <ProtectedRoute>
              <DigitalBusinessCard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/one-link"
          element={
            <ProtectedRoute>
              <OneLink />
            </ProtectedRoute>
          }
        />

        {/* Platform admin only */}
        <Route
          path="/platform-admin"
          element={
            <ProtectedRoute adminOnly>
              <PlatformAdmin />
            </ProtectedRoute>
          }
        />
      </Routes>
    </BrowserRouter>
  )
}

export default App
