import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, formatApiError } from "@/lib/api";
import { toast } from "sonner";
import { Wrench, MapPin, Phone } from "lucide-react";

export default function MyJobsPage() {
  const [jobs, setJobs] = useState([]);
  const [filter, setFilter] = useState("active");

  const load = async () => {
    try {
      const { data } = await api.get("/leads");
      setJobs(data);
    } catch (e) { toast.error(formatApiError(e)); }
  };
  useEffect(() => { load(); }, []);

  const filtered = jobs.filter((j) => {
    if (filter === "active") return ["assigned_technician", "in_progress"].includes(j.status);
    if (filter === "completed") return j.status === "completed";
    return true;
  });

  return (
    <div className="space-y-6" data-testid="my-jobs-page">
      <div>
        <div className="gr-overline">Field Ops</div>
        <h1 className="font-display font-black text-4xl tracking-tighter mt-1">My Jobs</h1>
      </div>

      <div className="flex gap-2">
        {[["active", "Active"], ["completed", "Completed"], ["all", "All"]].map(([k, l]) => (
          <button key={k} onClick={() => setFilter(k)}
            className={`gr-btn ${filter === k ? "gr-btn-primary" : "gr-btn-outline"}`}
            data-testid={`filter-${k}`}>
            {l}
          </button>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {filtered.length === 0 && <div className="gr-card text-center py-12 text-neutral-400 md:col-span-2">No jobs in this view.</div>}
        {filtered.map((j) => (
          <Link to={`/console/leads/${j.id}`} key={j.id} className="gr-card gr-card-hover block" data-testid={`job-${j.id}`}>
            <div className="flex items-start justify-between mb-3">
              <div>
                <div className="gr-overline">{j.appliance_type}</div>
                <div className="font-display font-bold text-xl mt-1">{j.customer_name}</div>
              </div>
              <span className={`gr-badge ${j.status}`}>{j.status.replace("_", " ")}</span>
            </div>
            <div className="text-sm text-neutral-600 mb-3">{j.issue}</div>
            <div className="flex items-center justify-between text-xs text-neutral-500 font-mono">
              <span className="flex items-center gap-1"><MapPin size={12} /> {j.city}</span>
              <span className="flex items-center gap-1"><Phone size={12} /> {j.phone}</span>
              <span className={`gr-badge ${j.priority}`}>{j.priority}</span>
            </div>
            <div className="mt-3 pt-3 border-t border-neutral-200 flex items-center justify-between">
              <span className="text-xs text-neutral-500">Open for details</span>
              <Wrench size={14} className="text-[#ff5f1f]" />
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
