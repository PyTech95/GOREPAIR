import React, { useState } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { ArrowRight } from "lucide-react";

const QUICK = [
  { label: "Super Admin", email: "admin@gorepair.in", password: "admin123" },
  { label: "Manager (Delhi)", email: "rahul.manager@gorepair.in", password: "manager123" },
  { label: "Technician (Delhi)", email: "amit.tech@gorepair.in", password: "tech123" },
];

export default function LoginPage() {
  const { user, login } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  if (user) return <Navigate to="/" replace />;

  const submit = async (e) => {
    e?.preventDefault?.();
    setLoading(true);
    const r = await login(email, password);
    setLoading(false);
    if (!r.ok) { toast.error(r.error || "Login failed"); return; }
    toast.success(`Welcome back, ${r.user.name}`);
    nav("/");
  };

  const quickFill = (q) => { setEmail(q.email); setPassword(q.password); };

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-white" data-testid="login-page">
      {/* Left: hero */}
      <div className="relative hidden lg:block bg-[#0a0a0a] overflow-hidden">
        <img
          src="https://images.unsplash.com/photo-1768051579338-3dc694863efc?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjAzMzV8MHwxfHNlYXJjaHwxfHxob21lJTIwYXBwbGlhbmNlJTIwd2FzaGluZyUyMG1hY2hpbmUlMjByZXBhaXJ8ZW58MHx8fHwxNzc2NTM1NDU5fDA&ixlib=rb-4.1.0&q=85"
          alt=""
          className="absolute inset-0 w-full h-full object-cover opacity-30"
        />
        <div className="absolute inset-0 bg-gradient-to-br from-[#0a0a0a] via-[#0a0a0a]/80 to-transparent" />
        <div className="relative z-10 h-full flex flex-col justify-between p-10 text-white">
          <div className="flex items-center gap-3">
            <img
              src="https://customer-assets.emergentagent.com/job_points-repair-net/artifacts/63eed0iz_image.png"
              alt="GO Repair"
              className="h-14 w-14 object-contain"
              data-testid="login-hero-logo"
            />
            <div className="font-display font-black text-3xl tracking-tight leading-none">
              <div>GO</div>
              <div className="text-[#ff5f1f] -mt-0.5">REPAIR</div>
            </div>
          </div>
          <div className="space-y-6">
            <div className="gr-overline text-[#ff5f1f]">OPERATIONS CONSOLE / v1.0</div>
            <h1 className="font-display font-black text-5xl xl:text-6xl leading-[0.95] tracking-tighter">
              Dispatch.<br />Assign.<br />
              <span className="text-[#ff5f1f]">Collect.</span>
            </h1>
            <p className="text-neutral-300 max-w-md text-[15px] leading-relaxed">
              The command center for appliance repair operators in India — leads, wallet, technicians, and AI-assisted dispatch in one place.
            </p>
            <div className="flex gap-4 text-xs font-mono text-neutral-500 uppercase tracking-widest pt-4">
              <span>▪ LEADS</span><span>▪ WALLET</span><span>▪ AI DISPATCH</span>
            </div>
          </div>
          <div className="text-xs font-mono text-neutral-500">© GO REPAIR · BUILT FOR INDIA</div>
        </div>
      </div>

      {/* Right: form */}
      <div className="flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-md">
          <div className="lg:hidden flex items-center gap-2 mb-8">
            <img
              src="https://customer-assets.emergentagent.com/job_points-repair-net/artifacts/63eed0iz_image.png"
              alt="GO Repair"
              className="h-10 w-10 object-contain"
            />
            <div className="font-display font-black text-2xl tracking-tight leading-none">
              <div>GO</div>
              <div className="text-[#ff5f1f] -mt-0.5">REPAIR</div>
            </div>
          </div>
          <div className="gr-overline mb-2">SIGN IN</div>
          <h2 className="font-display font-black text-3xl tracking-tighter mb-6">Access your console</h2>

          <form onSubmit={submit} className="space-y-4" data-testid="login-form">
            <div>
              <label className="gr-label">Email</label>
              <input
                type="email"
                required
                className="gr-input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@gorepair.in"
                data-testid="login-email-input"
              />
            </div>
            <div>
              <label className="gr-label">Password</label>
              <input
                type="password"
                required
                className="gr-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                data-testid="login-password-input"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="gr-btn gr-btn-primary w-full"
              data-testid="login-submit-btn"
            >
              {loading ? "Signing in…" : (<>Sign in <ArrowRight size={16} /></>)}
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-neutral-200">
            <div className="gr-overline mb-3">QUICK TEST ACCOUNTS</div>
            <div className="grid grid-cols-1 gap-2">
              {QUICK.map((q) => (
                <button
                  key={q.email}
                  type="button"
                  onClick={() => quickFill(q)}
                  className="text-left px-3 py-2 border border-neutral-200 hover:border-[#ff5f1f] hover:bg-orange-50/40 transition-colors flex items-center justify-between"
                  data-testid={`quick-${q.label.toLowerCase().replace(/[^a-z]/g, "-")}`}
                >
                  <div>
                    <div className="font-semibold text-xs">{q.label}</div>
                    <div className="text-[11px] font-mono text-neutral-500">{q.email}</div>
                  </div>
                  <ArrowRight size={14} className="text-neutral-400" />
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
