import React, { useEffect, useState } from "react";
import { api, formatApiError } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

const SRC_COLORS = {
  facebook: "#1877f2", google: "#0f9d58", whatsapp: "#25d366",
  website: "#ff5f1f", manual: "#71717a", referral: "#8b5cf6", justdial: "#f59e0b",
};

export default function AnalyticsPage() {
  const { user } = useAuth();
  const [overview, setOverview] = useState(null);
  const [techs, setTechs] = useState([]);

  useEffect(() => {
    api.get("/analytics/overview").then((r) => setOverview(r.data)).catch((e) => toast.error(formatApiError(e)));
    if (user?.role !== "technician") {
      api.get("/analytics/technicians").then((r) => setTechs(r.data)).catch(() => {});
    }
  }, [user]);

  return (
    <div className="space-y-6" data-testid="analytics-page">
      <div>
        <div className="gr-overline">Insights</div>
        <h1 className="font-display font-black text-4xl tracking-tighter mt-1">Analytics</h1>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatTile label="Total Leads" value={overview?.total_leads ?? "—"} />
        <StatTile label="Conversion" value={`${overview?.conversion_rate ?? 0}%`} />
        <StatTile label="Completed" value={overview?.completed ?? "—"} />
        <StatTile label="Revenue (₹)" value={overview?.revenue ? `₹${overview.revenue.toLocaleString("en-IN")}` : "—"} />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="gr-card">
          <div className="gr-overline mb-2">By source</div>
          <div className="font-display font-bold text-lg mb-3">Lead flow by channel</div>
          <div style={{ width: "100%", height: 260 }}>
            <ResponsiveContainer>
              <BarChart data={overview?.sources || []}>
                <XAxis dataKey="source" stroke="#71717a" fontSize={11} />
                <YAxis stroke="#71717a" fontSize={11} />
                <Tooltip contentStyle={{ border: "1px solid #e4e4e7", borderRadius: 2 }} />
                <Bar dataKey="count">
                  {(overview?.sources || []).map((s) => <Cell key={s.source} fill={SRC_COLORS[s.source] || "#0a0a0a"} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {user?.role !== "technician" && (
          <div className="gr-card p-0 overflow-hidden">
            <div className="px-5 py-4 border-b border-neutral-200">
              <div className="gr-overline">Team</div>
              <div className="font-display font-bold text-lg mt-0.5">Technician leaderboard</div>
            </div>
            <div className="overflow-x-auto">
              <table className="gr-table">
                <thead><tr><th>#</th><th>Name</th><th>City</th><th>Rating</th><th>Jobs</th><th>Active</th></tr></thead>
                <tbody>
                  {techs.length === 0 && <tr><td colSpan={6} className="text-center py-8 text-neutral-400">No data</td></tr>}
                  {techs.map((t, i) => (
                    <tr key={t.id}>
                      <td className="font-mono text-neutral-400">#{i + 1}</td>
                      <td className="font-semibold">{t.name}</td>
                      <td>{t.city || "—"}</td>
                      <td className="font-mono">★ {t.rating}</td>
                      <td className="font-mono">{t.jobs_completed}</td>
                      <td className="font-mono">{t.active_jobs}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StatTile({ label, value }) {
  return (
    <div className="gr-card gr-metric" data-testid={`stat-${label.toLowerCase().replace(/ /g, "-")}`}>
      <div className="gr-overline">{label}</div>
      <div className="font-display font-black text-3xl tracking-tighter mt-1">{value}</div>
    </div>
  );
}
