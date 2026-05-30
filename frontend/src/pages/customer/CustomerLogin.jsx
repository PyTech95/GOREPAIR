import React, { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { api, formatApiError } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export default function CustomerLogin({ mode = "login" }) {
  const { setUser } = useAuth();
  const nav = useNavigate();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const url = mode === "register" ? "/customer/register" : "/customer/login";
      const payload = mode === "register" ? { name, phone, password, city } : { phone, password };
      const { data } = await api.post(url, payload);
      localStorage.setItem("gr_token", data.token);
      setUser(data.user);
      toast.success(mode === "register" ? "Welcome to GO Repair!" : `Welcome back, ${data.user.name}`);
      nav("/");
    } catch (e2) { toast.error(formatApiError(e2)); }
    finally { setBusy(false); }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-white" data-testid="customer-auth-page">
      <div className="hidden lg:flex flex-col justify-between p-10 bg-gradient-to-br from-[#fff7f0] to-white">
        <Link to="/" className="flex items-center gap-2 w-fit">
          <img src="https://customer-assets.emergentagent.com/job_points-repair-net/artifacts/63eed0iz_image.png" alt="GO Repair" className="h-10 w-10 object-contain" />
          <div className="font-display font-black text-2xl leading-none">
            <span>GO</span><span className="text-[#ff5f1f]">REPAIR</span>
          </div>
        </Link>
        <div>
          <div className="gr-overline text-[#ff5f1f]">{mode === "register" ? "JOIN GO REPAIR" : "WELCOME BACK"}</div>
          <h1 className="font-display font-black text-5xl tracking-tighter mt-3 leading-[1.05]">
            {mode === "register" ? <>Repairs<br />delivered to<br />your door.</> : <>Sign in to<br />track your<br />bookings.</>}
          </h1>
          <p className="text-neutral-600 mt-4 max-w-md">Trained technicians, transparent pricing, 30-day warranty.</p>
        </div>
        <div className="text-xs text-neutral-400 font-mono">© GO REPAIR · BUILT FOR INDIA</div>
      </div>

      <div className="flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-md">
          <Link to="/" className="lg:hidden flex items-center gap-2 mb-8">
            <img src="https://customer-assets.emergentagent.com/job_points-repair-net/artifacts/63eed0iz_image.png" alt="GO Repair" className="h-9 w-9 object-contain" />
            <div className="font-display font-black text-xl leading-none">
              <span>GO</span><span className="text-[#ff5f1f]">REPAIR</span>
            </div>
          </Link>
          <h2 className="font-display font-black text-3xl tracking-tighter mb-2">
            {mode === "register" ? "Create your account" : "Login to your account"}
          </h2>
          <p className="text-sm text-neutral-500 mb-6">
            {mode === "register" ? "Takes less than 30 seconds." : "Phone number + password."}
          </p>

          <form onSubmit={submit} className="space-y-4" data-testid="customer-auth-form">
            {mode === "register" && (
              <div>
                <label className="gr-label">Your name</label>
                <input required className="gr-input" value={name} onChange={(e) => setName(e.target.value)} data-testid="auth-name" placeholder="Riya Sharma" />
              </div>
            )}
            <div>
              <label className="gr-label">Phone number</label>
              <input required type="tel" minLength={8} className="gr-input" value={phone}
                onChange={(e) => setPhone(e.target.value)} data-testid="auth-phone" placeholder="9876543210" />
            </div>
            <div>
              <label className="gr-label">Password</label>
              <input required type="password" minLength={6} className="gr-input" value={password}
                onChange={(e) => setPassword(e.target.value)} data-testid="auth-password" placeholder="••••••••" />
            </div>
            {mode === "register" && (
              <div>
                <label className="gr-label">City (optional)</label>
                <input className="gr-input" value={city} onChange={(e) => setCity(e.target.value)} data-testid="auth-city" placeholder="Delhi / Mumbai / Bengaluru" />
              </div>
            )}
            <button type="submit" disabled={busy} className="gr-btn gr-btn-primary w-full text-base py-3" data-testid="auth-submit">
              {busy ? (mode === "register" ? "Creating…" : "Signing in…") : (mode === "register" ? "Create account" : "Sign in")}
            </button>
          </form>

          <div className="mt-6 text-center text-sm text-neutral-500">
            {mode === "register" ? (
              <>Already have an account? <Link to="/customer/login" className="text-[#ff5f1f] font-semibold hover:underline" data-testid="switch-to-login">Log in</Link></>
            ) : (
              <>New to GO Repair? <Link to="/customer/register" className="text-[#ff5f1f] font-semibold hover:underline" data-testid="switch-to-register">Create an account</Link></>
            )}
          </div>
          <div className="mt-4 text-center">
            <Link to="/login" className="text-xs text-neutral-400 hover:text-neutral-700">Partner / Staff login →</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
