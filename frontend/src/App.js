import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import LoginPage from "@/pages/LoginPage";
import DashboardPage from "@/pages/DashboardPage";
import LeadsPage from "@/pages/LeadsPage";
import LeadDetailPage from "@/pages/LeadDetailPage";
import UsersPage from "@/pages/UsersPage";
import WalletPage from "@/pages/WalletPage";
import BrandKitPage from "@/pages/BrandKitPage";
import AnalyticsPage from "@/pages/AnalyticsPage";
import SettingsPage from "@/pages/SettingsPage";
import MyJobsPage from "@/pages/MyJobsPage";
import MapPage from "@/pages/MapPage";
import NotificationsPage from "@/pages/NotificationsPage";
import Layout from "@/components/Layout";

// Customer (public marketplace) pages
import CustomerLanding from "@/pages/customer/CustomerLanding";
import CustomerLogin from "@/pages/customer/CustomerLogin";
import ServicesPage from "@/pages/customer/ServicesPage";
import BookingPage from "@/pages/customer/BookingPage";
import MyBookings from "@/pages/customer/MyBookings";
import TrackBooking from "@/pages/customer/TrackBooking";

const STAFF_ROLES = ["super_admin", "manager", "technician"];

function StaffRoute({ children, roles }) {
  const { user } = useAuth();
  if (user === null) return (
    <div className="min-h-screen flex items-center justify-center text-sm text-neutral-500" data-testid="auth-loading">Loading…</div>
  );
  if (!user || !STAFF_ROLES.includes(user.role)) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/console" replace />;
  return children;
}

function CustomerRoute({ children }) {
  const { user } = useAuth();
  if (user === null) return (
    <div className="min-h-screen flex items-center justify-center text-sm text-neutral-500" data-testid="auth-loading">Loading…</div>
  );
  if (!user || user.role !== "customer") return <Navigate to="/customer/login" replace />;
  return children;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Toaster position="top-right" richColors />
        <Routes>
          {/* Public customer marketplace */}
          <Route path="/" element={<CustomerLanding />} />
          <Route path="/services" element={<ServicesPage />} />
          <Route path="/book/:sku" element={<BookingPage />} />
          <Route path="/customer/login" element={<CustomerLogin mode="login" />} />
          <Route path="/customer/register" element={<CustomerLogin mode="register" />} />
          <Route path="/my-bookings" element={<CustomerRoute><MyBookings /></CustomerRoute>} />
          <Route path="/track/:bid" element={<CustomerRoute><TrackBooking /></CustomerRoute>} />

          {/* Staff console */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/console" element={<StaffRoute><Layout /></StaffRoute>}>
            <Route index element={<DashboardPage />} />
            <Route path="leads" element={<LeadsPage />} />
            <Route path="leads/:lid" element={<LeadDetailPage />} />
            <Route path="my-jobs" element={<StaffRoute roles={["technician"]}><MyJobsPage /></StaffRoute>} />
            <Route path="users" element={<StaffRoute roles={["super_admin", "manager"]}><UsersPage /></StaffRoute>} />
            <Route path="wallet" element={<StaffRoute roles={["manager", "super_admin"]}><WalletPage /></StaffRoute>} />
            <Route path="brand-kit" element={<StaffRoute roles={["manager"]}><BrandKitPage /></StaffRoute>} />
            <Route path="analytics" element={<AnalyticsPage />} />
            <Route path="map" element={<MapPage />} />
            <Route path="notifications" element={<NotificationsPage />} />
            <Route path="settings" element={<StaffRoute roles={["super_admin"]}><SettingsPage /></StaffRoute>} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
