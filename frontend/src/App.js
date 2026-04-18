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

function ProtectedRoute({ children, roles }) {
  const { user } = useAuth();
  if (user === null) return (
    <div className="min-h-screen flex items-center justify-center text-sm text-neutral-500" data-testid="auth-loading">Loading…</div>
  );
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Toaster position="top-right" richColors />
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
            <Route index element={<DashboardPage />} />
            <Route path="leads" element={<LeadsPage />} />
            <Route path="leads/:lid" element={<LeadDetailPage />} />
            <Route path="my-jobs" element={<ProtectedRoute roles={["technician"]}><MyJobsPage /></ProtectedRoute>} />
            <Route path="users" element={<ProtectedRoute roles={["super_admin", "manager"]}><UsersPage /></ProtectedRoute>} />
            <Route path="wallet" element={<ProtectedRoute roles={["manager", "super_admin"]}><WalletPage /></ProtectedRoute>} />
            <Route path="brand-kit" element={<ProtectedRoute roles={["manager"]}><BrandKitPage /></ProtectedRoute>} />
            <Route path="analytics" element={<AnalyticsPage />} />
            <Route path="map" element={<MapPage />} />
            <Route path="notifications" element={<NotificationsPage />} />
            <Route path="settings" element={<ProtectedRoute roles={["super_admin"]}><SettingsPage /></ProtectedRoute>} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
