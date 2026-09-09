"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Mail, Lock, ArrowRight, ShieldCheck } from "lucide-react";
import { LogoBadge } from "@/components/LogoBadge";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-white px-4">
      {/* Nền chuyển động tông đỏ-trắng */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-32 -top-32 h-[28rem] w-[28rem] animate-blob-float rounded-full bg-gradient-to-br from-rose-600/20 to-red-400/10 blur-3xl" />
        <div
          className="absolute -bottom-40 -right-24 h-[32rem] w-[32rem] animate-blob-float rounded-full bg-gradient-to-tr from-red-700/15 to-rose-300/10 blur-3xl"
          style={{ animationDelay: "-6s" }}
        />
        <div
          className="absolute left-1/2 top-1/3 h-72 w-72 -translate-x-1/2 animate-blob-float rounded-full bg-rose-500/10 blur-3xl"
          style={{ animationDelay: "-10s" }}
        />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#00000006_1px,transparent_1px),linear-gradient(to_bottom,#00000006_1px,transparent_1px)] bg-[size:44px_44px]" />
      </div>

      <div className="relative grid w-full max-w-4xl overflow-hidden rounded-3xl border border-red-100 bg-white shadow-2xl shadow-red-900/10 md:grid-cols-5">
        {/* Panel thương hiệu */}
        <div className="relative col-span-2 hidden flex-col justify-between overflow-hidden bg-gradient-to-br from-red-700 via-red-600 to-rose-700 p-8 text-white md:flex">
          <div className="pointer-events-none absolute inset-0 opacity-25">
            <div className="absolute left-1/2 top-1/2 h-56 w-56 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white/40 animate-ring-pulse" />
            <div
              className="absolute left-1/2 top-1/2 h-56 w-56 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white/40 animate-ring-pulse"
              style={{ animationDelay: "1.1s" }}
            />
          </div>

          <div className="relative animate-fade-in-up">
            <LogoBadge size="lg" />
          </div>

          <div className="relative animate-fade-in-up" style={{ animationDelay: "0.1s" }}>
            <h1 className="text-xl font-bold leading-snug">Trường Đại học Y Hà Nội</h1>
            <p className="mt-1 text-2xl font-bold leading-snug">Phân Hiệu Thanh Hóa</p>
            <p className="mt-3 text-sm leading-relaxed text-red-50/90">
              Hệ thống phân công &amp; theo dõi công việc nội bộ — kết nối Ban Giám Đốc, Thư ký
              Phân Hiệu và các Phòng ban trong cùng một quy trình.
            </p>
          </div>

          <div className="relative flex items-center gap-2 text-xs text-red-100/80 animate-fade-in-up" style={{ animationDelay: "0.2s" }}>
            <ShieldCheck className="h-4 w-4" />
            Truy cập nội bộ — chỉ dành cho cán bộ được cấp tài khoản
          </div>
        </div>

        {/* Form đăng nhập */}
        <div className="col-span-3 flex flex-col justify-center p-8 sm:p-12">
          <div className="mb-8 flex items-center gap-3 md:hidden animate-fade-in-up">
            <LogoBadge size="md" />
            <div>
              <p className="text-sm font-semibold text-slate-900">Đại học Y Hà Nội</p>
              <p className="text-xs text-red-600">Phân Hiệu Thanh Hóa</p>
            </div>
          </div>

          <div className="animate-fade-in-up" style={{ animationDelay: "0.05s" }}>
            <h2 className="text-2xl font-bold text-slate-900">Đăng nhập hệ thống</h2>
            <p className="mt-1 text-sm text-slate-500">Nhập thông tin tài khoản được cấp để tiếp tục.</p>
          </div>

          <form onSubmit={onSubmit} className="mt-7 space-y-4 animate-fade-in-up" style={{ animationDelay: "0.12s" }}>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Email</label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="ten.can.bo@hmu.edu.vn"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-3 text-sm outline-none transition focus:border-red-400 focus:bg-white focus:ring-2 focus:ring-red-100"
                />
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Mật khẩu</label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-3 text-sm outline-none transition focus:border-red-400 focus:bg-white focus:ring-2 focus:ring-red-100"
                />
              </div>
            </div>

            {error && (
              <p className="animate-fade-in-up rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="group relative flex w-full items-center justify-center gap-1.5 overflow-hidden rounded-xl bg-gradient-to-r from-red-600 to-rose-600 px-3 py-2.5 text-sm font-semibold text-white shadow-lg shadow-red-600/25 transition hover:shadow-red-600/40 disabled:opacity-60"
            >
              {loading && <span className="absolute inset-0 animate-shimmer" />}
              {loading ? "Đang đăng nhập..." : "Đăng nhập"}
              {!loading && <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />}
            </button>
          </form>

          <p className="mt-8 text-center text-xs text-slate-400 animate-fade-in-up" style={{ animationDelay: "0.18s" }}>
            © {new Date().getFullYear()} Trường Đại học Y Hà Nội — Phân Hiệu Thanh Hóa
          </p>
        </div>
      </div>
    </div>
  );
}
