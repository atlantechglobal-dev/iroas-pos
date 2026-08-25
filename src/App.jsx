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
import Dashboard from './pages/Dashboard/Dashboard'
import RestaurantProfile from './pages/RestaurantProfile/RestaurantProfile'
import DirectoryListings from './pages/DirectoryListings/DirectoryListings'
import DigitalBusinessCard from './pages/DigitalBusinessCard/DigitalBusinessCard'
import OneLink from './pages/OneLink/OneLink'
import PlatformAdmin from './pages/PlatformAdmin/PlatformAdmin'
import Menu from './pages/Menu/Menu'
import Orders from './pages/Orders/Orders'
import Reservations from './pages/Reservations/Reservations'
import Tables from './pages/Tables/Tables'
import Staff from './pages/Staff/Staff'
import Analytics from './pages/Analytics/Analytics'
import Payments from './pages/Payments/Payments'
import Marketing from './pages/Marketing/Marketing'
import Reviews from './pages/Reviews/Reviews'
import PosIntegration from './pages/PosIntegration/PosIntegration'
import Notifications from './pages/Notifications/Notifications'
import Settings from './pages/Settings/Settings'

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
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/restaurant-profile"
          element={
            <ProtectedRoute>
              <RestaurantProfile />
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
        <Route
          path="/menu"
          element={
            <ProtectedRoute>
              <Menu />
            </ProtectedRoute>
          }
        />
        <Route
          path="/orders"
          element={
            <ProtectedRoute>
              <Orders />
            </ProtectedRoute>
          }
        />
        <Route
          path="/reservations"
          element={
            <ProtectedRoute>
              <Reservations />
            </ProtectedRoute>
          }
        />
        <Route
          path="/tables"
          element={
            <ProtectedRoute>
              <Tables />
            </ProtectedRoute>
          }
        />
        <Route
          path="/staff"
          element={
            <ProtectedRoute>
              <Staff />
            </ProtectedRoute>
          }
        />
        <Route
          path="/analytics"
          element={
            <ProtectedRoute>
              <Analytics />
            </ProtectedRoute>
          }
        />
        <Route
          path="/payments"
          element={
            <ProtectedRoute>
              <Payments />
            </ProtectedRoute>
          }
        />
        <Route
          path="/marketing"
          element={
            <ProtectedRoute>
              <Marketing />
            </ProtectedRoute>
          }
        />
        <Route
          path="/reviews"
          element={
            <ProtectedRoute>
              <Reviews />
            </ProtectedRoute>
          }
        />
        <Route
          path="/pos-integration"
          element={
            <ProtectedRoute>
              <PosIntegration />
            </ProtectedRoute>
          }
        />
        <Route
          path="/notifications"
          element={
            <ProtectedRoute>
              <Notifications />
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings"
          element={
            <ProtectedRoute>
              <Settings />
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
