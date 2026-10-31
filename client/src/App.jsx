import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './auth/AuthContext';
import ProtectedRoute from './auth/ProtectedRoute';

// Auth pages
import Login          from './pages/auth/Login';
import Signup         from './pages/auth/Signup';
import ForgotPassword from './pages/auth/ForgotPassword';
import ResetPassword  from './pages/auth/ResetPassword';

// Admin pages
import Users     from './pages/admin/Users';
import Customers from './pages/admin/Customers';
import Products  from './pages/admin/Products';
import Plans     from './pages/admin/Plans';
import Taxes     from './pages/admin/Taxes';

// Stage 2 pages
import Templates          from './pages/sales/Templates';
import Subscriptions      from './pages/sales/Subscriptions';
import SubscriptionDetail from './pages/sales/SubscriptionDetail';
import Discounts          from './pages/sales/Discounts';
import Invoices           from './pages/billing/Invoices';
import InvoiceDetail      from './pages/billing/InvoiceDetail';
import InvoicePrint       from './pages/billing/InvoicePrint';
import RunBilling         from './pages/billing/RunBilling';
import MySubscriptions    from './pages/portal/MySubscriptions';

function RootRedirect() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === 'PORTAL') return <Navigate to="/portal/subscriptions" replace />;
  return <Navigate to="/sales/subscriptions" replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public routes */}
          <Route path="/login"           element={<Login />} />
          <Route path="/signup"          element={<Signup />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password"  element={<ResetPassword />} />

          {/* Admin-only routes */}
          <Route path="/admin/users"
            element={<ProtectedRoute roles={['ADMIN']}><Users /></ProtectedRoute>} />

          {/* Admin + Internal routes */}
          <Route path="/admin/customers"
            element={<ProtectedRoute roles={['ADMIN', 'INTERNAL']}><Customers /></ProtectedRoute>} />
          <Route path="/admin/products"
            element={<ProtectedRoute roles={['ADMIN', 'INTERNAL']}><Products /></ProtectedRoute>} />
          <Route path="/admin/plans"
            element={<ProtectedRoute roles={['ADMIN', 'INTERNAL']}><Plans /></ProtectedRoute>} />
          <Route path="/admin/taxes"
            element={<ProtectedRoute roles={['ADMIN', 'INTERNAL']}><Taxes /></ProtectedRoute>} />

          {/* Stage 2: Sales & Billing routes (ADMIN + INTERNAL) */}
          <Route path="/sales/templates"
            element={<ProtectedRoute roles={['ADMIN', 'INTERNAL']}><Templates /></ProtectedRoute>} />
          <Route path="/sales/subscriptions"
            element={<ProtectedRoute roles={['ADMIN', 'INTERNAL']}><Subscriptions /></ProtectedRoute>} />
          <Route path="/sales/subscriptions/:id"
            element={<ProtectedRoute roles={['ADMIN', 'INTERNAL']}><SubscriptionDetail /></ProtectedRoute>} />
          <Route path="/sales/discounts"
            element={<ProtectedRoute roles={['ADMIN', 'INTERNAL']}><Discounts /></ProtectedRoute>} />
          <Route path="/billing/invoices"
            element={<ProtectedRoute roles={['ADMIN', 'INTERNAL']}><Invoices /></ProtectedRoute>} />
          <Route path="/billing/invoices/:id"
            element={<ProtectedRoute roles={['ADMIN', 'INTERNAL']}><InvoiceDetail /></ProtectedRoute>} />
          <Route path="/billing/invoices/:id/print"
            element={<ProtectedRoute roles={['ADMIN', 'INTERNAL', 'PORTAL']}><InvoicePrint /></ProtectedRoute>} />
          <Route path="/billing/run"
            element={<ProtectedRoute roles={['ADMIN', 'INTERNAL']}><RunBilling /></ProtectedRoute>} />

          {/* Portal routes */}
          <Route path="/portal/subscriptions"
            element={<ProtectedRoute roles={['PORTAL', 'ADMIN', 'INTERNAL']}><MySubscriptions /></ProtectedRoute>} />

          {/* Fallbacks */}
          <Route path="/unauthorized" element={
            <div className="flex h-screen items-center justify-center text-gray-500">
              <div className="text-center">
                <p className="text-4xl font-bold text-red-400">403</p>
                <p className="mt-2">You don't have permission to view this page.</p>
              </div>
            </div>
          } />
          <Route path="/" element={<RootRedirect />} />
          <Route path="*" element={<RootRedirect />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
