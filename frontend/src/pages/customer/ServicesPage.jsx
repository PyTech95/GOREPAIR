import React, { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { api, formatApiError } from "@/lib/api";
import { toast } from "sonner";
import { ArrowRight, ArrowLeft, Clock, IndianRupee } from "lucide-react";

const ICON = { snowflake: "❄️", waves: "🌊", refrigerator: "🧊", microwave: "🍽", tv: "📺", droplets: "💧", filter: "💦", fan: "💨", utensils: "🍴" };

export default function ServicesPage() {
  const [cats, setCats] = useState([]);
  const loc = useLocation();
  useEffect(() => {
    api.get("/catalog").then((r) => setCats(r.data.categories)).catch((e) => toast.error(formatApiError(e)));
  }, []);
  useEffect(() => {
    if (loc.hash && cats.length) {
      const el = document.getElementById(loc.hash.substring(1));
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [loc, cats]);

  return (
    <div className="min-h-screen bg-white" data-testid="services-page">
      <header className="border-b border-neutral-200 sticky top-0 bg-white z-30">
        <div className="max-w-6xl mx-auto px-4 sm:px-8 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <ArrowLeft size={18} className="text-neutral-500" />
            <div className="font-display font-bold">All services</div>
          </Link>
          <Link to="/my-bookings" className="text-sm font-semibold hover:text-[#ff5f1f]">My bookings</Link>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-8 py-8 sm:py-12 space-y-12">
        {cats.map((c) => (
          <section key={c.sku} id={c.sku}>
            <div className="flex items-end justify-between mb-6 gap-3">
              <div>
                <div className="text-3xl mb-1">{ICON[c.icon]}</div>
                <h2 className="font-display font-black text-3xl tracking-tighter">{c.name}</h2>
                <div className="text-sm text-neutral-500 mt-1">{c.tagline}</div>
              </div>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
              {c.services.map((s) => (
                <Link
                  key={s.sku}
                  to={`/book/${s.sku}`}
                  className="border border-neutral-200 hover:border-[#ff5f1f] hover:shadow-md transition-all p-5 bg-white group flex flex-col"
                  data-testid={`svc-${s.sku}`}
                >
                  <div className="font-display font-bold text-lg leading-tight">{s.name}</div>
                  <div className="text-xs text-neutral-500 mt-2 flex-1">{s.desc}</div>
                  <div className="mt-4 pt-3 border-t border-neutral-100 flex items-center justify-between">
                    <div>
                      <div className="font-display font-black text-2xl text-[#ff5f1f] leading-none">
                        ₹{s.price}
                      </div>
                      <div className="text-[11px] text-neutral-400 font-mono uppercase tracking-wider mt-0.5 flex items-center gap-1">
                        <Clock size={10} /> {s.duration}
                      </div>
                    </div>
                    <ArrowRight size={18} className="text-neutral-300 group-hover:text-[#ff5f1f] group-hover:translate-x-1 transition-all" />
                  </div>
                </Link>
              ))}
            </div>
          </section>
        ))}
      </main>
    </div>
  );
}
