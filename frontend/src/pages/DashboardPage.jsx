import React, { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { Link } from "react-router-dom";
import { ArrowUpRight, TrendingUp, Users, Wallet, Wrench, Sparkles } from "lucide-react";

function Stat({ label, value, sub, icon: Icon, testid }) {
  return (
    <div className="gr-card gr-metric" data-testid={testid}>
      <div className="flex items-start justify-between">
        <div className="gr-overline">{label}</div>
        {Icon && <Icon size={16} className="text-neutral-400" />}
      </div>
      <div className="mt-2 font-display font-black text-3xl tracking-tighter">{value}</div>
      {sub && <div className="mt-1 text-xs text-neutral-500">{sub}</div>}
    </div>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [overview, setOverview] = useState(null);
  const [recent, setRecent] = useState([]);
  const [balance, setBalance] = useState(null);

  useEffect(() => {
    api.get("/analytics/overview").then((r) => setOverview(r.data)).catch(() => {});
    api.get("/leads").then((r) => setRecent(r.data.slice(0, 6))).catch(() => {});
    if (user?.role === "manager") {
      api.get("/wallet/me").then((r) => setBalance(r.data.balance)).catch(() => {});
    }
  }, [user]);

  return (
    <div className="space-y-8" data-testid="dashboard-page">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <div className="gr-overline">{user?.role?.replace("_", " ").toUpperCase()}</div>
          <h1 className="font-display font-black text-4xl sm:text-5xl tracking-tighter mt-1">
            Hello, {user?.name?.split(" ")[0]}.
          </h1>
          <p className="text-neutral-500 text-sm mt-2">Here's your ops snapshot in real time.</p>
        </div>
        {user?.role !== "technician" && (
          <Link to="/console/leads" className="gr-btn gr-btn-outline" data-testid="go-leads-btn">
            View all leads <ArrowUpRight size={15} />
          </Link>
        )}
      </div>

      {/* KPI grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat
          label="Total Leads"
          value={overview?.total_leads ?? "—"}
          sub={`${overview?.new_leads ?? 0} new`}
          icon={TrendingUp}
          testid="stat-total-leads"
        />
        <Stat
          label="In Progress"
          value={overview?.in_progress ?? "—"}
          sub={`${overview?.completed ?? 0} completed`}
          icon={Wrench}
          testid="stat-in-progress"
        />
        <Stat
          label="Conversion"
          value={`${overview?.conversion_rate ?? 0}%`}
          sub="Completed / total"
          icon={TrendingUp}
          testid="stat-conversion"
        />
        {user?.role === "manager" ? (
          <Stat
            label="Wallet Balance"
            value={balance != null ? `${balance} pts` : "—"}
            sub={`${overview?.points_spent ?? 0} pts spent`}
            icon={Wallet}
            testid="stat-wallet"
          />
        ) : (
          <Stat
            label="Revenue (₹)"
            value={overview?.revenue ? `₹${overview.revenue.toLocaleString("en-IN")}` : "—"}
            sub="From completed jobs"
            icon={TrendingUp}
            testid="stat-revenue"
          />
        )}
      </div>

      {/* Role-specific callouts */}
      {user?.role === "manager" && !user?.has_brand_kit && (
        <div className="gr-ai-panel flex items-center gap-4 flex-wrap" data-testid="brand-kit-prompt">
          <Sparkles className="text-[#002fa7]" />
          <div className="flex-1 min-w-[240px]">
            <div className="font-display font-bold">Get your GO Repair Brand Kit</div>
            <div className="text-sm text-neutral-600">Order your T-shirts, bill book, and starter tools to go live as a certified operator.</div>
          </div>
          <Link to="/console/brand-kit" className="gr-btn gr-btn-primary" data-testid="brand-kit-cta">Open Brand Kit Store</Link>
        </div>
      )}

      {/* Recent leads + Sources */}
      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 gr-card p-0 overflow-hidden">
          <div className="px-5 py-4 border-b border-neutral-200 flex items-center justify-between">
            <div>
              <div className="gr-overline">Recent Leads</div>
              <div className="font-display font-bold text-lg mt-0.5">Latest activity</div>
            </div>
            <Link to="/console/leads" className="text-xs font-semibold text-[#ff5f1f] hover:underline">View all</Link>
          </div>
          <div className="overflow-x-auto">
            <table className="gr-table">
              <thead><tr><th>Customer</th><th>Appliance</th><th>City</th><th>Status</th></tr></thead>
              <tbody>
                {recent.length === 0 && (
                  <tr><td colSpan={4} className="text-center py-8 text-neutral-400">No leads yet</td></tr>
                )}
                {recent.map((l) => (
                  <tr key={l.id} data-testid={`recent-lead-${l.id}`}>
                    <td className="font-semibold">{l.customer_name}</td>
                    <td className="text-neutral-600">{l.appliance_type}</td>
                    <td className="text-neutral-600">{l.city}</td>
                    <td><span className={`gr-badge ${l.status}`}>{l.status.replace("_", " ")}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="gr-card">
          <div className="gr-overline">Lead sources</div>
          <div className="font-display font-bold text-lg mt-0.5 mb-4">Where traffic comes from</div>
          <div className="space-y-3">
            {(overview?.sources || []).length === 0 && <div className="text-sm text-neutral-400">No data yet</div>}
            {(overview?.sources || []).map((s) => {
              const pct = overview.total_leads ? Math.round((s.count / overview.total_leads) * 100) : 0;
              return (
                <div key={s.source} data-testid={`source-${s.source}`}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="font-semibold uppercase tracking-wider">{s.source}</span>
                    <span className="font-mono text-neutral-500">{s.count} · {pct}%</span>
                  </div>
                  <div className="h-2 bg-neutral-100 rounded-sm overflow-hidden">
                    <div className="h-full bg-[#ff5f1f]" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
