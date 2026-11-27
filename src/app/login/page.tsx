"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Lock, Eye, EyeOff } from "lucide-react";
import { BrandHeader, AppFooter, Watermark } from "@/components/AppHeader";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

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
    <div className="flex min-h-screen flex-col bg-neutral-50">
      <Watermark />
      <BrandHeader />
      <main className="gb-main relative z-[1] w-full flex-1 px-4 py-6">
        <div className="mx-auto mt-10 max-w-sm overflow-hidden rounded-2xl bg-white shadow-xl">
          <div className="h-1.5 bg-gradient-to-r from-red-700 via-red-600 to-red-800" />
          <div className="p-8">
            <div className="mb-3 flex justify-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-700">
                <Lock className="h-6 w-6" />
              </div>
            </div>
            <h1 className="mb-1 text-center text-xl font-semibold">Đăng nhập</h1>
            <p className="mb-5 text-center text-sm text-slate-500">Hệ thống Quản lý &amp; Phân công công việc</p>

            {error && (
              <div className="mb-3 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
            )}

            <form onSubmit={onSubmit} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium">Email</label>
                <input
                  type="email"
                  required
                  autoFocus
                  autoComplete="username"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="ten.can.bo@hmu.edu.vn"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2.5"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Mật khẩu</label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 py-2.5 pl-3 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:text-red-700"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-lg bg-red-700 py-2.5 font-medium text-white hover:bg-red-800 disabled:opacity-60"
              >
                {loading ? "Đang đăng nhập..." : "Đăng nhập"}
              </button>
            </form>

            <p className="mt-5 flex items-center justify-center gap-1 text-center text-xs text-slate-400">
              <Lock className="h-3.5 w-3.5" />
              Kết nối được bảo mật
            </p>
            <p className="mt-2 text-center text-xs text-slate-400">
              Cán bộ đăng nhập bằng email công vụ được cấp. Đổi mật khẩu ngay sau lần đăng nhập đầu tiên.
            </p>
          </div>
        </div>
      </main>
      <AppFooter />
    </div>
  );
}
