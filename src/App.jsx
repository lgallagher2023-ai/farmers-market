import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { CartProvider } from './context/CartContext'
import ErrorBoundary from './components/ui/ErrorBoundary'
import ProtectedRoute from './components/layout/ProtectedRoute'
import CustomerLayout from './components/layout/CustomerLayout'
import VendorLayout from './components/layout/VendorLayout'
import AdminLayout from './components/layout/AdminLayout'
import MiniCart from './components/cart/MiniCart'

// Auth
import Login from './pages/auth/Login'
import SignUp from './pages/auth/SignUp'
import ForgotPassword from './pages/auth/ForgotPassword'
import ResetPassword from './pages/auth/ResetPassword'
import VendorSignUp from './pages/vendor/auth/VendorSignUp'

// Customer onboarding
import CustomerSurvey from './pages/customer/Survey'

// Vendor onboarding
import VendorSurvey from './pages/vendor/onboarding/VendorSurvey'
import StorefrontPreview from './pages/vendor/onboarding/StorefrontPreview'
import Walkthrough from './pages/vendor/onboarding/Walkthrough'

// Customer screens
import Home from './pages/customer/Home'
import Search from './pages/customer/Search'
import VendorStorefront from './pages/customer/VendorStorefront'
import ProductPage from './pages/customer/ProductPage'
import Cart from './pages/customer/Cart'
import Checkout from './pages/customer/Checkout'
import OrderConfirmation from './pages/customer/OrderConfirmation'
import OrderTracking from './pages/customer/OrderTracking'
import Orders from './pages/customer/Orders'
import Following from './pages/customer/Following'
import NearMe from './pages/customer/NearMe'
import Profile from './pages/customer/Profile'

// Vendor screens
import VendorDashboard from './pages/vendor/Dashboard'
import VendorOrders from './pages/vendor/Orders'
import VendorProducts from './pages/vendor/Products'
import ProductForm from './pages/vendor/ProductForm'
import VendorInventory from './pages/vendor/Inventory'
import VendorSchedule from './pages/vendor/Schedule'
import VendorPayouts from './pages/vendor/Payouts'
import VendorProfile from './pages/vendor/Profile'
import StorefrontCustomizer from './pages/vendor/StorefrontCustomizer'

// Admin screens
import AdminDashboard from './pages/admin/AdminDashboard'
import AdminMarkets from './pages/admin/Markets'
import AdminVendorApprovals from './pages/admin/VendorApprovals'
import AdminOrders from './pages/admin/AdminOrders'

// Placeholder for screens to be built in Phase 2+
const Soon = ({ label }) => (
  <div className="flex items-center justify-center h-64 text-gray-400">{label} — coming soon</div>
)

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <CartProvider>
            {/*
              MiniCart lives here — inside CartProvider so it can read cart state,
              but outside Routes so it appears on every page regardless of layout.
              It is fixed-position so it renders over any page content.
            */}
            <MiniCart />

            <Routes>
              {/* ── Public auth ── */}
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<SignUp />} />
              <Route path="/vendor/signup" element={<VendorSignUp />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password" element={<ResetPassword />} />

              {/* ── Vendor onboarding (auth required, but pre-approval) ── */}
              <Route element={<ProtectedRoute role="vendor" />}>
                <Route path="/vendor/signup/survey" element={<VendorSurvey />} />
                <Route path="/vendor/signup/preview" element={<StorefrontPreview />} />
                <Route path="/vendor/signup/walkthrough" element={<Walkthrough />} />
              </Route>

              {/* ── Customer onboarding ── */}
              <Route element={<ProtectedRoute role="customer" />}>
                <Route path="/signup/survey" element={<CustomerSurvey />} />
              </Route>

              {/* ── Customer screens (layout with bottom nav) ── */}
              <Route element={<ProtectedRoute role="customer" />}>
                <Route element={<CustomerLayout />}>
                  <Route path="/" element={<Home />} />
                  <Route path="/search" element={<Search />} />
                  <Route path="/near-me" element={<NearMe />} />
                  <Route path="/map" element={<Soon label="Map" />} />
                  <Route path="/orders" element={<Orders />} />
                  <Route path="/following" element={<Following />} />
                  <Route path="/profile" element={<Profile />} />
                </Route>

                {/* Authenticated-only full-screen customer screens */}
                <Route path="/orders/:orderId" element={<OrderTracking />} />
              </Route>

              {/*
                ── Public browsing + guest checkout ──────────────────────────
                These routes are accessible to unauthenticated (guest) users so
                they can browse, add to cart, and complete a purchase without
                creating an account first. Authenticated customers use them too.
              */}
              <Route path="/vendors/:vendorId" element={<VendorStorefront />} />
              <Route path="/products/:productId" element={<ProductPage />} />
              <Route path="/cart" element={<Cart />} />
              <Route path="/checkout" element={<Checkout />} />
              <Route path="/orders/:orderId/confirmation" element={<OrderConfirmation />} />

              {/* ── Vendor dashboard (sidebar layout) ── */}
              <Route element={<ProtectedRoute role="vendor" />}>
                <Route element={<VendorLayout />}>
                  <Route path="/vendor/dashboard" element={<VendorDashboard />} />
                  <Route path="/vendor/orders" element={<VendorOrders />} />
                  <Route path="/vendor/products" element={<VendorProducts />} />
                  <Route path="/vendor/products/new" element={<ProductForm />} />
                  <Route path="/vendor/products/:productId/edit" element={<ProductForm />} />
                  <Route path="/vendor/inventory" element={<VendorInventory />} />
                  <Route path="/vendor/schedule" element={<VendorSchedule />} />
                  <Route path="/vendor/storefront" element={<StorefrontCustomizer />} />
                  <Route path="/vendor/payouts" element={<VendorPayouts />} />
                  <Route path="/vendor/profile" element={<VendorProfile />} />
                </Route>
              </Route>

              {/* ── Admin ── */}
              <Route element={<ProtectedRoute role="admin" />}>
                <Route element={<AdminLayout />}>
                  <Route path="/admin" element={<AdminDashboard />} />
                  <Route path="/admin/markets" element={<AdminMarkets />} />
                  <Route path="/admin/vendors" element={<AdminVendorApprovals />} />
                  <Route path="/admin/orders" element={<AdminOrders />} />
                </Route>
              </Route>

              {/* Fallback */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </CartProvider>
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  )
}
