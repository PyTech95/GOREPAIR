import React, { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import {
  LayoutDashboard, ListOrdered, Users, Wallet, ShoppingBag,
  BarChart3, Settings, Wrench, LogOut, Menu, X, Map, Bell
} from "lucide-react";

const roleNav = {
  super_admin: [
    { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
    { to: "/leads", label: "Leads", icon: ListOrdered },
    { to: "/users", label: "Users", icon: Users },
    { to: "/wallet", label: "Wallets", icon: Wallet },
    { to: "/map", label: "Live Map", icon: Map },
    { to: "/analytics", label: "Analytics", icon: BarChart3 },
    { to: "/notifications", label: "Notifications", icon: Bell },
    { to: "/settings", label: "Settings", icon: Settings },
  ],
  manager: [
    { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
    { to: "/leads", label: "My Leads", icon: ListOrdered },
    { to: "/users", label: "Technicians", icon: Users },
    { to: "/map", label: "Live Map", icon: Map },
    { to: "/wallet", label: "Wallet", icon: Wallet },
    { to: "/brand-kit", label: "Brand Kit", icon: ShoppingBag },
    { to: "/analytics", label: "Analytics", icon: BarChart3 },
    { to: "/notifications", label: "Notifications", icon: Bell },
  ],
  technician: [
    { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
    { to: "/my-jobs", label: "My Jobs", icon: Wrench },
    { to: "/map", label: "Live Tracking", icon: Map },
    { to: "/notifications", label: "Notifications", icon: Bell },
  ],
};

function Sidebar({ open, onClose }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const nav = roleNav[user?.role] || [];

  const handleLogout = () => { logout(); navigate("/login"); };

  return (
    <>
      {open && (
        <button
          aria-label="Close menu"
          onClick={onClose}
          className="fixed inset-0 bg-black/40 z-30 lg:hidden"
          data-testid="sidebar-backdrop"
        />
      )}
      <aside
        className={`fixed left-0 top-0 h-screen w-64 bg-[#0a0a0a] text-white flex flex-col z-40 transition-transform duration-300 lg:translate-x-0 ${open ? "translate-x-0" : "-translate-x-full"}`}
        data-testid="sidebar"
      >
        <div className="px-5 py-5 flex items-center justify-between border-b border-neutral-800">
          <div className="flex items-center gap-2">
            <img
              src="https://customer-assets.emergentagent.com/job_points-repair-net/artifacts/63eed0iz_image.png"
              alt="GO Repair"
              className="h-8 w-8 object-contain"
              data-testid="sidebar-logo"
            />
            <div className="font-display font-black text-lg tracking-tight leading-none">
              <div>GO</div>
              <div className="text-[#ff5f1f] -mt-0.5">REPAIR</div>
            </div>
          </div>
          <button onClick={onClose} className="lg:hidden text-neutral-400 hover:text-white" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="px-5 py-4 border-b border-neutral-800">
          <div className="gr-overline text-neutral-500">Signed in as</div>
          <div className="mt-1 font-semibold text-sm truncate" data-testid="sidebar-user-name">{user?.name}</div>
          <div className="text-xs text-neutral-400 capitalize">{user?.role?.replace("_", " ")}</div>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          {nav.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                onClick={onClose}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-[#ff5f1f] text-white"
                      : "text-neutral-300 hover:bg-neutral-800 hover:text-white"
                  }`
                }
                data-testid={`nav-${item.label.toLowerCase().replace(/ /g, "-")}`}
              >
                <Icon size={17} />
                {item.label}
              </NavLink>
            );
          })}
        </nav>

        <button
          onClick={handleLogout}
          className="m-3 flex items-center gap-2 px-3 py-2.5 text-sm font-semibold text-neutral-300 border border-neutral-800 hover:bg-neutral-900 hover:text-white transition-colors"
          data-testid="logout-btn"
        >
          <LogOut size={16} /> Logout
        </button>
      </aside>
    </>
  );
}

export default function Layout() {
  const [open, setOpen] = useState(false);
  const { user } = useAuth();
  return (
    <div className="min-h-screen bg-[#f5f5f5]">
      <Sidebar open={open} onClose={() => setOpen(false)} />
      <div className="lg:ml-64 min-h-screen flex flex-col">
        <header className="sticky top-0 h-14 bg-white/95 backdrop-blur border-b border-neutral-200 flex items-center justify-between px-4 lg:px-8 z-20">
          <button onClick={() => setOpen(true)} className="lg:hidden" aria-label="Open menu" data-testid="open-sidebar-btn">
            <Menu size={20} />
          </button>
          <div className="font-display font-bold text-sm tracking-tight hidden lg:block">
            COMMAND CENTER <span className="text-neutral-400">/</span>{" "}
            <span className="text-neutral-500 capitalize">{user?.role?.replace("_", " ")}</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden sm:block text-xs text-neutral-500">{user?.email}</div>
            <div className="h-8 w-8 rounded-sm bg-[#ff5f1f] text-white font-bold grid place-items-center text-sm" data-testid="user-avatar">
              {user?.name?.[0]?.toUpperCase()}
            </div>
          </div>
        </header>
        <main className="flex-1 gr-container gr-fade-in" data-testid="main-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
