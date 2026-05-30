import React, { useEffect, useRef, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion, useScroll, useTransform, useInView, animate } from "framer-motion";
import { api, formatApiError } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import {
  ArrowRight, ArrowUpRight, Shield, Clock, Star, Phone, Menu, X,
  Snowflake, WashingMachine, Refrigerator, Microwave, Tv, Droplet,
  Filter, Fan, Utensils, Sparkles, CheckCircle2, MapPin, Zap,
} from "lucide-react";

const ICON = {
  snowflake: Snowflake,
  waves: WashingMachine,
  refrigerator: Refrigerator,
  microwave: Microwave,
  tv: Tv,
  droplets: Droplet,
  filter: Filter,
  fan: Fan,
  utensils: Utensils,
};

const TRUST_TICKER = [
  "30-DAY WARRANTY",
  "CERTIFIED TECHNICIANS",
  "TRANSPARENT PRICING",
  "GST INVOICE",
  "SAME-DAY SERVICE",
  "PAY AFTER REPAIR",
  "9 APPLIANCE CATEGORIES",
  "BUILT FOR INDIA",
];

const SUPPORT_TEL = "+919000000000";

/* ---------------- Animated counter ---------------- */
function Counter({ to, suffix = "", duration = 1.6, decimals = 0 }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!inView) return;
    const controls = animate(0, to, {
      duration,
      ease: "easeOut",
      onUpdate: (v) => setVal(v),
    });
    return () => controls.stop();
  }, [inView, to, duration]);
  const display = decimals
    ? val.toFixed(decimals)
    : Math.round(val).toLocaleString("en-IN");
  return <span ref={ref}>{display}{suffix}</span>;
}

/* ---------------- Reveal helper ---------------- */
const fadeUp = {
  initial: { opacity: 0, y: 28 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-60px" },
  transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] },
};

export default function CustomerLanding() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [cats, setCats] = useState([]);
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const heroRef = useRef(null);

  // Parallax for hero collage
  const { scrollY } = useScroll();
  const heroY = useTransform(scrollY, [0, 600], [0, -60]);
  const heroOpacity = useTransform(scrollY, [0, 400], [1, 0.5]);

  useEffect(() => {
    api.get("/catalog")
      .then((r) => setCats(r.data.categories))
      .catch((e) => toast.error(formatApiError(e)));
  }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const navLinks = (
    <>
      <Link to="/services" className="nav-link" data-testid="nav-services" onClick={() => setMenuOpen(false)}>
        Services
      </Link>
      {user?.role === "customer" ? (
        <Link to="/my-bookings" className="nav-link" data-testid="nav-mybookings" onClick={() => setMenuOpen(false)}>
          My bookings
        </Link>
      ) : user ? (
        <Link to="/console" className="nav-link text-neutral-500" data-testid="nav-console" onClick={() => setMenuOpen(false)}>
          Console <ArrowUpRight size={12} className="inline" />
        </Link>
      ) : (
        <>
          <Link to="/customer/login" className="nav-link" data-testid="nav-login" onClick={() => setMenuOpen(false)}>
            Login
          </Link>
          <Link
            to="/customer/register"
            className="gr-btn gr-btn-primary text-xs sm:text-sm"
            data-testid="nav-register"
            onClick={() => setMenuOpen(false)}
          >
            Sign up
          </Link>
        </>
      )}
    </>
  );

  return (
    <div className="min-h-screen bg-white text-[#0a0a0a] overflow-x-clip" data-testid="customer-landing">
      <style>{`
        .nav-link {
          position: relative;
          font-weight: 600;
          font-size: 0.9rem;
          padding: 0.25rem 0;
          transition: color .2s;
        }
        .nav-link:hover { color: #ff5f1f; }
        .nav-link::after {
          content: "";
          position: absolute;
          left: 0; bottom: -2px;
          width: 100%;
          height: 2px;
          background: #ff5f1f;
          transform: scaleX(0);
          transform-origin: left;
          transition: transform .3s ease;
        }
        .nav-link:hover::after { transform: scaleX(1); }
        .brutal-shadow { box-shadow: 4px 4px 0 0 #0a0a0a; }
        .brutal-shadow-orange { box-shadow: 4px 4px 0 0 #ff5f1f; }
        .grain::before {
          content: "";
          position: absolute; inset: 0;
          background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 .35 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>");
          opacity: 0.4;
          pointer-events: none;
          mix-blend-mode: multiply;
        }
        @keyframes ticker {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .ticker-track { animation: ticker 30s linear infinite; }
      `}</style>

      {/* =================== HEADER =================== */}
      <header
        className={`fixed top-0 inset-x-0 z-40 transition-all duration-300 ${
          scrolled ? "bg-white/85 backdrop-blur-md border-b border-[#0a0a0a]/10" : "bg-transparent"
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5 shrink-0">
            <img
              src="https://customer-assets.emergentagent.com/job_points-repair-net/artifacts/63eed0iz_image.png"
              alt="GO Repair"
              className="h-9 w-9 object-contain"
            />
            <div className="font-display font-black text-xl leading-none tracking-tight">
              <span>GO</span>
              <span className="text-[#ff5f1f]">REPAIR</span>
            </div>
          </Link>
          <nav className="hidden md:flex items-center gap-7">{navLinks}</nav>
          <button
            className="md:hidden p-2 -mr-2"
            onClick={() => setMenuOpen(true)}
            aria-label="Open menu"
            data-testid="mobile-menu-open"
          >
            <Menu size={22} />
          </button>
        </div>
      </header>

      {/* Mobile slide-in menu */}
      {menuOpen && (
        <motion.div
          initial={{ x: "100%" }}
          animate={{ x: 0 }}
          exit={{ x: "100%" }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          className="fixed inset-0 z-50 bg-white md:hidden flex flex-col"
          data-testid="mobile-menu-panel"
        >
          <div className="h-16 flex items-center justify-between px-4 border-b border-[#0a0a0a]/10">
            <div className="font-display font-black text-xl">
              GO<span className="text-[#ff5f1f]">REPAIR</span>
            </div>
            <button onClick={() => setMenuOpen(false)} aria-label="Close menu" data-testid="mobile-menu-close">
              <X size={22} />
            </button>
          </div>
          <nav className="flex-1 flex flex-col items-start gap-6 p-8 text-2xl font-display font-bold">
            {navLinks}
          </nav>
        </motion.div>
      )}

      {/* =================== HERO =================== */}
      <section ref={heroRef} className="relative pt-28 sm:pt-32 lg:pt-36 pb-16 lg:pb-24">
        {/* Background slab */}
        <div className="absolute top-0 right-0 w-full lg:w-1/2 h-[80%] bg-[#fff7f0] -z-10" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid lg:grid-cols-12 gap-8 lg:gap-12 items-center">
          {/* Left content */}
          <motion.div
            initial="hidden"
            animate="visible"
            variants={{
              hidden: {},
              visible: { transition: { staggerChildren: 0.08 } },
            }}
            className="lg:col-span-7 relative z-10"
          >
            <motion.div
              variants={{ hidden: { opacity: 0, y: 14 }, visible: { opacity: 1, y: 0 } }}
              className="gr-overline text-[#ff5f1f]"
            >
              <span className="inline-block h-1.5 w-1.5 bg-[#ff5f1f] mr-2 align-middle" />
              FAST · CERTIFIED · DOORSTEP
            </motion.div>

            <motion.h1
              variants={{ hidden: { opacity: 0, y: 22 }, visible: { opacity: 1, y: 0 } }}
              className="font-display font-black text-5xl sm:text-6xl lg:text-7xl xl:text-8xl tracking-tighter mt-4 leading-[0.95]"
            >
              Home appliance
              <br />
              repairs at your
              <br />
              <span className="relative inline-block">
                <span className="relative z-10 text-[#ff5f1f]">doorstep.</span>
                <motion.span
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={{ duration: 0.8, delay: 0.6, ease: [0.22, 1, 0.36, 1] }}
                  className="absolute left-0 bottom-1 h-2 sm:h-3 w-full bg-[#ff5f1f]/20 origin-left -z-0"
                />
              </span>
            </motion.h1>

            <motion.p
              variants={{ hidden: { opacity: 0, y: 18 }, visible: { opacity: 1, y: 0 } }}
              className="text-neutral-600 mt-6 text-base sm:text-lg lg:text-xl max-w-lg leading-relaxed"
            >
              Trained technicians, transparent pricing, same-day visits for AC, washing machine, fridge, TV and more — across India.
            </motion.p>

            <motion.div
              variants={{ hidden: { opacity: 0, y: 14 }, visible: { opacity: 1, y: 0 } }}
              className="mt-8 flex gap-3 flex-wrap"
            >
              <button
                onClick={() => nav("/services")}
                className="group inline-flex items-center gap-2 bg-[#ff5f1f] text-white font-bold px-7 py-4 text-base sm:text-lg transition-all hover:-translate-y-0.5 hover:translate-x-0 brutal-shadow active:translate-y-0 active:shadow-none"
                data-testid="hero-book-cta"
              >
                Book a service
                <ArrowRight size={18} className="transition-transform group-hover:translate-x-1" />
              </button>
              <a
                href={`tel:${SUPPORT_TEL}`}
                className="inline-flex items-center gap-2 bg-white border-2 border-[#0a0a0a] font-bold px-6 py-4 text-base sm:text-lg transition-all hover:bg-[#0a0a0a] hover:text-white"
                data-testid="hero-call-cta"
              >
                <Phone size={16} /> Call us
              </a>
            </motion.div>

            <motion.div
              variants={{ hidden: { opacity: 0, y: 10 }, visible: { opacity: 1, y: 0 } }}
              className="mt-8 flex items-center gap-5 sm:gap-7 flex-wrap text-xs sm:text-sm text-neutral-700"
            >
              <div className="flex items-center gap-1.5">
                <Shield size={15} className="text-[#16a34a]" /> 30-day warranty
              </div>
              <div className="flex items-center gap-1.5">
                <Clock size={15} className="text-[#002fa7]" /> Same-day visits
              </div>
              <div className="flex items-center gap-1.5">
                <Star size={15} className="text-[#facc15] fill-[#facc15]" /> 4.7 / 5 (12K+ reviews)
              </div>
            </motion.div>
          </motion.div>

          {/* Right collage */}
          <motion.div style={{ y: heroY, opacity: heroOpacity }} className="lg:col-span-5 relative hidden lg:block">
            <div className="relative h-[480px]">
              <motion.div
                initial={{ opacity: 0, x: 40, rotate: -2 }}
                animate={{ opacity: 1, x: 0, rotate: -2 }}
                transition={{ duration: 0.7, delay: 0.2 }}
                className="absolute top-0 left-0 w-[60%] aspect-[3/4] border-2 border-[#0a0a0a] brutal-shadow-orange overflow-hidden bg-[#fff7f0]"
              >
                {cats[1]?.image ? (
                  <img src={cats[1].image} alt={cats[1].name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full grid place-items-center text-[#ff5f1f]"><WashingMachine size={80} /></div>
                )}
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-3">
                  <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-white/70">Trending</div>
                  <div className="font-display font-black text-white text-lg leading-tight">
                    {cats[1]?.name || "Washing Machine"}
                  </div>
                </div>
              </motion.div>
              <motion.div
                initial={{ opacity: 0, y: 40, rotate: 3 }}
                animate={{ opacity: 1, y: 0, rotate: 3 }}
                transition={{ duration: 0.7, delay: 0.45 }}
                className="absolute bottom-0 right-0 w-[58%] aspect-[4/5] border-2 border-[#0a0a0a] brutal-shadow overflow-hidden bg-[#fff7f0]"
              >
                {cats[2]?.image ? (
                  <img src={cats[2].image} alt={cats[2].name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full grid place-items-center text-[#ff5f1f]"><Refrigerator size={80} /></div>
                )}
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-3">
                  <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-white/70">In demand</div>
                  <div className="font-display font-black text-white text-lg leading-tight">
                    {cats[2]?.name || "Refrigerator"}
                  </div>
                </div>
              </motion.div>
              {/* Floating badge */}
              <motion.div
                initial={{ opacity: 0, scale: 0.6 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.9, type: "spring", stiffness: 200 }}
                className="absolute top-4 right-4 bg-white border-2 border-[#0a0a0a] brutal-shadow px-3 py-2 flex items-center gap-2 z-10"
              >
                <div className="h-8 w-8 bg-[#16a34a] grid place-items-center text-white">
                  <CheckCircle2 size={16} />
                </div>
                <div>
                  <div className="text-[10px] font-mono uppercase tracking-wider text-neutral-500">Avg response</div>
                  <div className="font-display font-black text-sm leading-none">22 mins</div>
                </div>
              </motion.div>
              <motion.div
                initial={{ opacity: 0, scale: 0.6 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 1.05, type: "spring", stiffness: 200 }}
                className="absolute bottom-6 left-2 bg-[#0a0a0a] text-white px-3 py-2 flex items-center gap-2 z-10"
              >
                <Zap size={14} className="text-[#ff5f1f] fill-[#ff5f1f]" />
                <div>
                  <div className="text-[10px] font-mono uppercase tracking-wider text-neutral-400">Today</div>
                  <div className="font-display font-black text-sm leading-none">37 repairs done</div>
                </div>
              </motion.div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* =================== TRUST TICKER =================== */}
      <section className="bg-[#0a0a0a] text-white py-4 border-y-2 border-[#0a0a0a] overflow-hidden">
        <div className="ticker-track flex gap-10 whitespace-nowrap will-change-transform">
          {[...TRUST_TICKER, ...TRUST_TICKER].map((t, i) => (
            <span
              key={i}
              className="font-mono text-xs sm:text-sm uppercase tracking-[0.2em] flex items-center gap-10"
            >
              {t}
              <Sparkles size={12} className="text-[#ff5f1f]" />
            </span>
          ))}
        </div>
      </section>

      {/* =================== CATEGORIES =================== */}
      <section id="services" className="py-20 lg:py-28 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div {...fadeUp} className="flex items-end justify-between flex-wrap gap-4 mb-10 lg:mb-14">
          <div>
            <div className="gr-overline">CHOOSE YOUR APPLIANCE</div>
            <h2 className="font-display font-black text-4xl sm:text-5xl lg:text-6xl tracking-tighter mt-2">
              What needs fixing?
            </h2>
          </div>
          <Link to="/services" className="hidden sm:inline-flex nav-link items-center gap-1" data-testid="nav-all-services">
            See all services <ArrowRight size={14} />
          </Link>
        </motion.div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-5">
          {cats.map((c, i) => {
            const Icon = ICON[c.icon] || Sparkles;
            return (
              <motion.div
                key={c.sku}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{ duration: 0.5, delay: (i % 4) * 0.06, ease: "easeOut" }}
              >
                <Link
                  to={`/services#${c.sku}`}
                  className="group block bg-white border-2 border-[#0a0a0a] p-4 sm:p-5 lg:p-6 transition-all duration-200 hover:-translate-y-1 hover:translate-x-0 hover:brutal-shadow-orange active:translate-y-0 active:shadow-none h-full"
                  data-testid={`cat-${c.sku}`}
                >
                  <div className="flex items-start justify-between mb-4">
                    <motion.div
                      whileHover={{ scale: 1.15, rotate: -8 }}
                      transition={{ type: "spring", stiffness: 300 }}
                      className="h-12 w-12 sm:h-14 sm:w-14 bg-[#fff7f0] border-2 border-[#0a0a0a] grid place-items-center text-[#ff5f1f]"
                    >
                      <Icon size={24} strokeWidth={2.2} />
                    </motion.div>
                    <ArrowUpRight
                      size={18}
                      className="text-neutral-300 group-hover:text-[#ff5f1f] transition-all group-hover:translate-x-1 group-hover:-translate-y-1"
                    />
                  </div>
                  <div className="font-display font-bold text-base sm:text-lg lg:text-xl leading-tight">
                    {c.name}
                  </div>
                  <div className="text-xs sm:text-sm text-neutral-500 mt-1.5 line-clamp-2">
                    {c.tagline}
                  </div>
                  <div className="mt-4 pt-3 border-t border-neutral-200 text-[11px] font-mono uppercase tracking-wider text-[#ff5f1f] font-bold">
                    {c.services.length} services →
                  </div>
                </Link>
              </motion.div>
            );
          })}
        </div>
      </section>

      {/* =================== STATS BAND =================== */}
      <section className="relative bg-[#0a0a0a] text-white py-20 lg:py-24 overflow-hidden grain">
        <div className="absolute inset-0 opacity-[0.04]"
             style={{ backgroundImage: "radial-gradient(circle at 1px 1px, white 1px, transparent 0)", backgroundSize: "32px 32px" }} />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <motion.div {...fadeUp} className="max-w-2xl mb-12">
            <div className="gr-overline text-[#ff5f1f]">BY THE NUMBERS</div>
            <h2 className="font-display font-black text-4xl sm:text-5xl lg:text-6xl tracking-tighter mt-2">
              India trusts us<br />for what matters.
            </h2>
          </motion.div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-y-10 gap-x-6">
            {[
              { v: 12000, suf: "+", l: "Happy customers" },
              { v: 450, suf: "+", l: "Trained technicians" },
              { v: 9, suf: "", l: "Appliance categories" },
              { v: 4.7, suf: "/5", l: "Average rating", dec: 1 },
            ].map((s, i) => (
              <motion.div
                key={s.l}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{ duration: 0.5, delay: i * 0.08 }}
              >
                <div className="font-display font-black text-5xl sm:text-6xl lg:text-7xl tracking-tighter text-[#ff5f1f] leading-none">
                  <Counter to={s.v} suffix={s.suf} decimals={s.dec || 0} />
                </div>
                <div className="text-xs sm:text-sm text-neutral-400 uppercase tracking-[0.18em] font-mono mt-3">
                  {s.l}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* =================== HOW IT WORKS =================== */}
      <section className="py-20 lg:py-28 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div {...fadeUp} className="max-w-2xl mb-12 lg:mb-16">
          <div className="gr-overline">HOW IT WORKS</div>
          <h2 className="font-display font-black text-4xl sm:text-5xl lg:text-6xl tracking-tighter mt-2">
            Book in under<br />
            <span className="text-[#ff5f1f]">90 seconds.</span>
          </h2>
        </motion.div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8">
          {[
            { n: "01", t: "Pick a service", d: "Browse 9 appliance categories and select what needs fixing.", Icon: Sparkles },
            { n: "02", t: "Tell us where", d: "Choose your address and a 2-hour slot that works for you.", Icon: MapPin },
            { n: "03", t: "We dispatch", d: "A certified technician is assigned and notified instantly.", Icon: Zap },
            { n: "04", t: "Fixed & rated", d: "Pay on completion, download GST invoice, rate the work.", Icon: CheckCircle2 },
          ].map((s, i) => (
            <motion.div
              key={s.n}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.6, delay: i * 0.1 }}
              className="relative"
            >
              <div className="font-display font-black text-7xl lg:text-8xl text-neutral-100 leading-none select-none">
                {s.n}
              </div>
              <div className="-mt-7 lg:-mt-9 relative">
                <div className="h-10 w-10 bg-[#0a0a0a] text-[#ff5f1f] grid place-items-center mb-4">
                  <s.Icon size={18} />
                </div>
                <div className="font-display font-bold text-xl lg:text-2xl">{s.t}</div>
                <div className="text-sm text-neutral-600 mt-2 leading-relaxed">{s.d}</div>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* =================== BIG CTA =================== */}
      <section className="px-4 sm:px-6 lg:px-8 pb-20 lg:pb-28">
        <motion.div
          {...fadeUp}
          className="max-w-7xl mx-auto bg-[#ff5f1f] text-white border-2 border-[#0a0a0a] brutal-shadow px-8 py-14 sm:px-12 sm:py-20 lg:px-16 lg:py-24 relative overflow-hidden"
        >
          <div className="relative z-10 grid lg:grid-cols-2 gap-8 items-center">
            <div>
              <div className="font-mono uppercase tracking-[0.2em] text-xs text-white/80">READY?</div>
              <h2 className="font-display font-black text-4xl sm:text-5xl lg:text-6xl xl:text-7xl tracking-tighter mt-3 leading-[0.95]">
                Your appliance is<br />one tap away from<br />working again.
              </h2>
            </div>
            <div className="flex flex-col sm:flex-row lg:justify-end gap-3 lg:gap-4">
              <button
                onClick={() => nav("/services")}
                className="inline-flex items-center justify-center gap-2 bg-white text-[#0a0a0a] font-bold px-7 py-4 text-base sm:text-lg transition-all hover:-translate-y-0.5 brutal-shadow active:translate-y-0 active:shadow-none"
                data-testid="footer-book-cta"
              >
                Book a service <ArrowRight size={18} />
              </button>
              <a
                href={`tel:${SUPPORT_TEL}`}
                className="inline-flex items-center justify-center gap-2 border-2 border-white font-bold px-6 py-4 text-base sm:text-lg transition-all hover:bg-white hover:text-[#0a0a0a]"
                data-testid="footer-call-cta"
              >
                <Phone size={16} /> {SUPPORT_TEL.replace("+91", "+91 ")}
              </a>
            </div>
          </div>
          <div className="absolute -right-20 -bottom-24 hidden lg:block">
            <Sparkles size={320} className="text-white/10" />
          </div>
        </motion.div>
      </section>

      {/* =================== FOOTER =================== */}
      <footer className="border-t-2 border-[#0a0a0a] bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 grid sm:grid-cols-2 gap-6">
          <div className="flex items-center gap-2.5">
            <img
              src="https://customer-assets.emergentagent.com/job_points-repair-net/artifacts/63eed0iz_image.png"
              alt="GO Repair"
              className="h-8 w-8 object-contain"
            />
            <div className="font-display font-black text-lg leading-none">
              <span>GO</span><span className="text-[#ff5f1f]">REPAIR</span>
            </div>
            <span className="text-xs font-mono text-neutral-500 ml-3">© 2026 · BUILT FOR INDIA</span>
          </div>
          <div className="flex items-center sm:justify-end gap-5 text-sm text-neutral-600">
            <a href={`tel:${SUPPORT_TEL}`} className="nav-link">Support · +91 90000 00000</a>
            <Link to="/login" className="nav-link" data-testid="footer-partner-login">Partner login</Link>
          </div>
        </div>
      </footer>

      {/* =================== MOBILE STICKY CTA =================== */}
      <div className="md:hidden fixed bottom-4 inset-x-4 z-30">
        <button
          onClick={() => nav("/services")}
          className="w-full inline-flex items-center justify-center gap-2 bg-[#ff5f1f] text-white font-bold px-6 py-4 text-base brutal-shadow border-2 border-[#0a0a0a] active:translate-y-0.5 active:shadow-none"
          data-testid="mobile-sticky-cta"
        >
          Book a service <ArrowRight size={18} />
        </button>
      </div>
    </div>
  );
}
