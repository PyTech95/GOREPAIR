import React, { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { api, formatApiError } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { ArrowRight, Shield, Clock, Star, IndianRupee, Wrench, Phone } from "lucide-react";

const ICON = {
  snowflake: "❄️", waves: "🌊", refrigerator: "🧊", microwave: "🍽",
  tv: "📺", droplets: "💧", filter: "💦", fan: "💨", utensils: "🍴",
};

export default function CustomerLanding() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [cats, setCats] = useState([]);

  useEffect(() => {
    api.get("/catalog").then((r) => setCats(r.data.categories)).catch((e) => toast.error(formatApiError(e)));
  }, []);

  // Staff users see a link to their console, but landing is public
  return (
    <div className="min-h-screen bg-white" data-testid="customer-landing">
      <header className="border-b border-neutral-200 bg-white sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 sm:px-8 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <img src="https://customer-assets.emergentagent.com/job_points-repair-net/artifacts/63eed0iz_image.png" alt="GO Repair" className="h-8 w-8 object-contain" />
            <div className="font-display font-black text-xl leading-none">
              <span>GO</span><span className="text-[#ff5f1f]">REPAIR</span>
            </div>
          </Link>
          <nav className="flex items-center gap-3 sm:gap-5 text-sm">
            <Link to="/services" className="font-semibold hover:text-[#ff5f1f] hidden sm:block" data-testid="nav-services">Services</Link>
            {user?.role === "customer" ? (
              <Link to="/my-bookings" className="font-semibold hover:text-[#ff5f1f]" data-testid="nav-mybookings">My bookings</Link>
            ) : user ? (
              <Link to="/console" className="font-semibold text-neutral-500 hover:text-[#ff5f1f]" data-testid="nav-console">Console →</Link>
            ) : (
              <>
                <Link to="/customer/login" className="font-semibold hover:text-[#ff5f1f]" data-testid="nav-login">Login</Link>
                <Link to="/customer/register" className="gr-btn gr-btn-primary text-xs" data-testid="nav-register">Sign up</Link>
              </>
            )}
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="bg-gradient-to-br from-[#fff7f0] to-white border-b border-neutral-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-8 py-12 sm:py-20 grid lg:grid-cols-2 gap-10 items-center">
          <div>
            <div className="gr-overline text-[#ff5f1f]">FAST · CERTIFIED · TRANSPARENT</div>
            <h1 className="font-display font-black text-4xl sm:text-5xl lg:text-6xl tracking-tighter mt-3 leading-[1.05]">
              Home appliance<br />repairs at your<br /><span className="text-[#ff5f1f]">doorstep.</span>
            </h1>
            <p className="text-neutral-600 mt-5 text-base sm:text-lg max-w-md">
              Trained technicians, transparent pricing, and same-day service for AC, washing machine, fridge, TV and more.
            </p>
            <div className="mt-7 flex gap-3 flex-wrap">
              <button onClick={() => nav("/services")} className="gr-btn gr-btn-primary text-base px-6 py-3" data-testid="hero-book-cta">
                Book a service <ArrowRight size={16} />
              </button>
              <a href="tel:+919000000000" className="gr-btn gr-btn-outline text-base px-6 py-3" data-testid="hero-call-cta">
                <Phone size={16} /> Call us
              </a>
            </div>
            <div className="mt-8 flex items-center gap-6 flex-wrap text-sm text-neutral-600">
              <div className="flex items-center gap-2"><Shield size={16} className="text-[#16a34a]" /> 30-day warranty</div>
              <div className="flex items-center gap-2"><Clock size={16} className="text-[#002fa7]" /> Same-day visits</div>
              <div className="flex items-center gap-2"><Star size={16} className="text-[#facc15] fill-[#facc15]" /> 4.7 / 5 (12K reviews)</div>
            </div>
          </div>
          <div className="hidden lg:block">
            <div className="grid grid-cols-2 gap-4">
              {cats.slice(0, 4).map((c) => (
                <Link key={c.sku} to={`/services#${c.sku}`} className="aspect-[4/3] relative overflow-hidden border-2 border-neutral-100 hover:border-[#ff5f1f] transition-colors group">
                  <img src={c.image} alt={c.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
                  <div className="absolute bottom-3 left-3 right-3 text-white">
                    <div className="text-2xl">{ICON[c.icon]}</div>
                    <div className="font-display font-bold">{c.name}</div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Categories */}
      <section id="services" className="py-12 sm:py-16 max-w-6xl mx-auto px-4 sm:px-8">
        <div className="gr-overline">CHOOSE YOUR APPLIANCE</div>
        <h2 className="font-display font-black text-3xl sm:text-4xl tracking-tighter mt-1 mb-8">What needs fixing?</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
          {cats.map((c) => (
            <Link
              key={c.sku}
              to={`/services#${c.sku}`}
              className="group border border-neutral-200 hover:border-[#ff5f1f] hover:shadow-lg transition-all p-4 sm:p-5 text-left bg-white"
              data-testid={`cat-${c.sku}`}
            >
              <div className="text-3xl mb-3">{ICON[c.icon] || "🔧"}</div>
              <div className="font-display font-bold text-base sm:text-lg">{c.name}</div>
              <div className="text-xs text-neutral-500 mt-1 line-clamp-2">{c.tagline}</div>
              <div className="mt-3 text-xs font-mono text-[#ff5f1f] flex items-center gap-1">
                {c.services.length} services <ArrowRight size={12} className="group-hover:translate-x-1 transition-transform" />
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Trust band */}
      <section className="bg-[#0a0a0a] text-white py-12 sm:py-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-8 grid grid-cols-2 lg:grid-cols-4 gap-8 text-center">
          {[
            { n: "12,000+", l: "Happy customers" },
            { n: "450+", l: "Trained technicians" },
            { n: "9", l: "Appliance categories" },
            { n: "30 days", l: "Service warranty" },
          ].map((s) => (
            <div key={s.l}>
              <div className="font-display font-black text-3xl sm:text-4xl tracking-tighter text-[#ff5f1f]">{s.n}</div>
              <div className="text-xs sm:text-sm text-neutral-400 uppercase tracking-wider mt-1">{s.l}</div>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="py-12 sm:py-16 max-w-6xl mx-auto px-4 sm:px-8">
        <div className="gr-overline">HOW IT WORKS</div>
        <h2 className="font-display font-black text-3xl sm:text-4xl tracking-tighter mt-1 mb-8">Book in under 90 seconds.</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {[
            { n: "01", t: "Pick a service", d: "Browse 9 appliance categories and select what needs fixing." },
            { n: "02", t: "Tell us where", d: "Choose your address and a 2-hour slot that works for you." },
            { n: "03", t: "We dispatch", d: "A certified technician is assigned and notified instantly." },
            { n: "04", t: "Fixed & rated", d: "Pay on completion, download GST invoice, rate the work." },
          ].map((s) => (
            <div key={s.n} className="border-l-4 border-[#ff5f1f] pl-4">
              <div className="font-mono text-[#ff5f1f] font-bold text-sm">{s.n}</div>
              <div className="font-display font-bold text-lg mt-1">{s.t}</div>
              <div className="text-sm text-neutral-600 mt-1">{s.d}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-neutral-200 py-8 text-sm text-neutral-500">
        <div className="max-w-6xl mx-auto px-4 sm:px-8 flex flex-wrap items-center justify-between gap-3">
          <div>© GO Repair · Built for India</div>
          <div className="flex gap-4">
            <a href="tel:+919000000000" className="hover:text-[#ff5f1f]">Support · +91 90000 00000</a>
            <Link to="/console" className="hover:text-[#ff5f1f]">Partner login</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
