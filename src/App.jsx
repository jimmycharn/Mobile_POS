import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import ProtectedRoute from './components/common/ProtectedRoute'
import AppLayout from './components/layout/AppLayout'

// Pages
import LoginPage from './pages/LoginPage'
import SignupPage from './pages/SignupPage'
import PosPage from './pages/PosPage'
import InventoryPage from './pages/InventoryPage'
import SalesReportPage from './pages/SalesReportPage'
import ShopSettingsPage from './pages/ShopSettingsPage'
import ActivityLogsPage from './pages/ActivityLogsPage'

// Superadmin Pages
import SuperadminDashboard from './pages/superadmin/SuperadminDashboard'
import SuperadminShops from './pages/superadmin/SuperadminShops'
import SuperadminProducts from './pages/superadmin/SuperadminProducts'
import SuperadminPackages from './pages/superadmin/SuperadminPackages'
import SuperadminLogs from './pages/superadmin/SuperadminLogs'
import SuperadminSettings from './pages/superadmin/SuperadminSettings'
import SuperadminShopDetail from './pages/superadmin/SuperadminShopDetail'

function AppRoutes() {
  const { user } = useAuth()

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to={user.role === 'superadmin' ? '/superadmin' : '/pos'} replace /> : <LoginPage />} />
      <Route path="/signup" element={user ? <Navigate to="/pos" replace /> : <SignupPage />} />

      <Route element={<AppLayout />}>
        {/* Shop Routes */}
        <Route path="/pos" element={<ProtectedRoute allowedRoles={['owner', 'staff']}><PosPage /></ProtectedRoute>} />
        <Route path="/inventory" element={<ProtectedRoute allowedRoles={['owner', 'staff']}><InventoryPage /></ProtectedRoute>} />
        <Route path="/reports" element={<ProtectedRoute allowedRoles={['owner', 'staff']}><SalesReportPage /></ProtectedRoute>} />
        <Route path="/logs" element={<ProtectedRoute allowedRoles={['owner', 'staff']}><ActivityLogsPage /></ProtectedRoute>} />
        <Route path="/settings" element={<ProtectedRoute allowedRoles={['owner', 'staff']}><ShopSettingsPage /></ProtectedRoute>} />

        {/* Superadmin Routes */}
        <Route path="/superadmin" element={<ProtectedRoute allowedRoles={['superadmin']}><SuperadminDashboard /></ProtectedRoute>} />
        <Route path="/superadmin/shops" element={<ProtectedRoute allowedRoles={['superadmin']}><SuperadminShops /></ProtectedRoute>} />
        <Route path="/superadmin/products" element={<ProtectedRoute allowedRoles={['superadmin']}><SuperadminProducts /></ProtectedRoute>} />
        <Route path="/superadmin/packages" element={<ProtectedRoute allowedRoles={['superadmin']}><SuperadminPackages /></ProtectedRoute>} />
        <Route path="/superadmin/shops/:shopId" element={<ProtectedRoute allowedRoles={['superadmin']}><SuperadminShopDetail /></ProtectedRoute>} />
        <Route path="/superadmin/settings" element={<ProtectedRoute allowedRoles={['superadmin']}><SuperadminSettings /></ProtectedRoute>} />
      </Route>

      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  )
}
