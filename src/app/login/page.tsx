"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { motion } from "framer-motion";

const HEADLINE = ["Hệ thống quản lý và", "phân công công việc"];
// Vị trí cố định (không random) để tránh lệch khi render
const HERO_PARTICLES = Array.from({ length: 12 }, (_, i) => ({
  left: (i * 37 + 9) % 100,
  size: 2 + ((i * 7) % 4),
  delay: (i * 0.9) % 10,
  duration: 11 + ((i * 5) % 8),
  drift: ((i % 5) - 2) * 14,
}));
const HERO_BOKEH = Array.from({ length: 5 }, (_, i) => ({
  left: (i * 43 + 5) % 90,
  top: (i * 31 + 10) % 80,
  size: 110 + ((i * 41) % 130),
  delay: -((i * 2.3) % 14),
  duration: 20 + ((i * 3) % 10),
}));

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Đăng nhập thất bại");
        return;
      }
      router.push("/dashboard");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen bg-background">
      {/* Vùng nhận diện — bên trái (ẩn trên mobile), có hiệu ứng động */}
      <section className="login-hero relative hidden w-[46%] max-w-[640px] flex-col justify-between overflow-hidden p-10 text-white lg:flex">
        <div className="login-dots" />
        <div className="idle-rays login-rays" />
        {HERO_BOKEH.map((b, i) => (
          <span
            key={`b${i}`}
            className="idle-bokeh"
            style={{ left: `${b.left}%`, top: `${b.top}%`, width: b.size, height: b.size, animationDelay: `${b.delay}s`, animationDuration: `${b.duration}s` }}
          />
        ))}
        {HERO_PARTICLES.map((p, i) => (
          <span
            key={`p${i}`}
            className="idle-particle"
            style={
              {
                left: `${p.left}%`,
                width: p.size,
                height: p.size,
                animationDelay: `${p.delay}s`,
                animationDuration: `${p.duration}s`,
                "--drift": `${p.drift}px`,
              } as React.CSSProperties
            }
          />
        ))}
        {/* Logo lớn in chìm, xoay rất chậm */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-phan-hieu.png" alt="" aria-hidden="true" className="login-big-logo" />
        <svg className="idle-waves" viewBox="0 0 2880 220" preserveAspectRatio="none" aria-hidden="true">
          <path className="idle-wave idle-wave-1" d="M0,120 C240,60 480,180 720,120 C960,60 1200,180 1440,120 C1680,60 1920,180 2160,120 C2400,60 2640,180 2880,120" />
          <path className="idle-wave idle-wave-2" d="M0,150 C240,100 480,200 720,150 C960,100 1200,200 1440,150 C1680,100 1920,200 2160,150 C2400,100 2640,200 2880,150" />
          <path className="idle-wave idle-wave-3" d="M0,180 C240,150 480,210 720,180 C960,150 1200,210 1440,180 C1680,150 1920,210 2160,180 C2400,150 2640,210 2880,180" />
        </svg>

        <div className="relative flex items-center gap-3">
          <motion.span
            initial={{ scale: 0, rotate: -90, opacity: 0 }}
            animate={{ scale: 1, rotate: 0, opacity: 1 }}
            transition={{ type: "spring", stiffness: 140, damping: 13, delay: 0.1 }}
            className="relative flex h-14 w-14 items-center justify-center"
          >
            <span className="login-logo-ring" />
            <span className="login-logo-pulse" />
            <span className="idle-logo relative flex h-14 w-14 items-center justify-center overflow-hidden rounded-full bg-white p-1.5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo-phan-hieu.png" alt="" className="h-full w-full object-contain" />
              <span className="idle-shine" aria-hidden="true" />
            </span>
          </motion.span>
          <div className="leading-tight">
            <motion.p
              initial={{ x: -24, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.35, duration: 0.6, ease: "easeOut" }}
              className="text-sm text-white/75"
            >
              Trường Đại học Y Hà Nội
            </motion.p>
            <motion.p
              initial={{ x: -24, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.5, duration: 0.6, ease: "easeOut" }}
              className="text-base font-semibold"
            >
              Phân hiệu tại Thanh Hoá
            </motion.p>
          </div>
        </div>

        <div className="relative">
          <h1 className="text-[32px] font-bold leading-tight">
            {HEADLINE.map((line, li) => (
              <span key={li} className="block overflow-hidden pb-1">
                {line.split(" ").map((w, wi) => (
                  <motion.span
                    key={wi}
                    initial={{ y: "110%", opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.7 + (li * 4 + wi) * 0.08, duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
                    className="mr-[0.25em] inline-block"
                  >
                    {w}
                  </motion.span>
                ))}
              </span>
            ))}
          </h1>
          <motion.div
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ delay: 1.5, duration: 0.8, ease: "easeOut" }}
            className="login-underline mt-4 h-[3px] w-28 origin-left rounded-full"
          />
        </div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.8, duration: 0.8 }}
          className="relative text-xs text-white/60"
        >
          © {new Date().getFullYear()} Phân hiệu Trường Đại học Y Hà Nội tại Thanh Hoá
        </motion.p>
      </section>

      {/* Form đăng nhập — bên phải */}
      <section className="relative flex flex-1 flex-col items-center justify-center overflow-hidden px-4 py-10 sm:px-8">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-phan-hieu.png" alt="" aria-hidden="true" className="watermark-logo !absolute" />
        <div className="relative z-[1] w-full max-w-[400px] animate-fade-in-up">
          <div className="mb-8 flex flex-col items-center text-center lg:hidden">
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-white p-1.5 shadow-sm ring-1 ring-line">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo-phan-hieu.png" alt="Logo Phân hiệu Thanh Hoá" className="h-full w-full object-contain" />
            </span>
            <p className="mt-3 text-sm font-semibold text-red-700">Phân hiệu Trường ĐH Y Hà Nội tại Thanh Hoá</p>
            <p className="text-xs text-muted">Hệ thống quản lý và phân công công việc</p>
          </div>

          <h2 className="text-2xl font-bold text-ink">Đăng nhập</h2>
          
          <form onSubmit={onSubmit} className="mt-7 space-y-4" noValidate={false}>
            <div>
              <label htmlFor="email" className="field-label">
                Tên đăng nhập (email)
              </label>
              <input
                id="email"
                type="email"
                required
                autoFocus
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ten.can.bo@hmu.edu.vn"
                className="field"
              />
            </div>
            <div>
              <label htmlFor="password" className="field-label">
                Mật khẩu
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="field pr-11"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                  className="absolute right-1 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-md text-slate-400 hover:text-ink"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {error && (
              <p role="alert" className="rounded-lg border border-red-100 bg-[#FEF2F2] px-3 py-2 text-sm text-[#B91C1C]">
                {error}
              </p>
            )}

            <button type="submit" disabled={loading} className="btn btn-primary w-full">
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {loading ? "Đang đăng nhập..." : "Đăng nhập"}
            </button>
          </form>
        </div>
      </section>
    </div>
  );
}
