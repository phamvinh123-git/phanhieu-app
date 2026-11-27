"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Loader2, CheckCircle2, LifeBuoy } from "lucide-react";

const HIGHLIGHTS = [
  "Chuyển kết luận cuộc họp thành nhiệm vụ cho các Phòng",
  "Theo dõi tiến độ bằng bảng Kanban 3 trạng thái",
  "Báo cáo tổng hợp theo đơn vị, đúng phạm vi quyền",
];

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
      {/* Vùng nhận diện — bên trái (ẩn trên mobile) */}
      <section className="relative hidden w-[46%] max-w-[640px] flex-col justify-between overflow-hidden bg-[#941827] p-10 text-white lg:flex">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage: "radial-gradient(circle at 1px 1px, #fff 1px, transparent 0)",
            backgroundSize: "22px 22px",
          }}
        />
        <div className="relative flex items-center gap-3">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-white p-1.5 shadow">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-phan-hieu.png" alt="" className="h-full w-full object-contain" />
          </span>
          <div className="leading-tight">
            <p className="text-sm text-white/75">Trường Đại học Y Hà Nội</p>
            <p className="text-base font-semibold">Phân hiệu tại Thanh Hoá</p>
          </div>
        </div>

        <div className="relative">
          <p className="text-sm font-semibold tracking-wide text-white/70">HMU TASKFLOW</p>
          <h1 className="mt-2 text-[32px] font-bold leading-tight">
            Hệ thống quản lý và
            <br />
            phân công công việc
          </h1>
          <ul className="mt-8 space-y-3">
            {HIGHLIGHTS.map((h) => (
              <li key={h} className="flex items-start gap-2.5 text-[15px] text-white/90">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-white/80" />
                {h}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-white/60">
          © {new Date().getFullYear()} Phân hiệu Trường Đại học Y Hà Nội tại Thanh Hoá
        </p>
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
          <p className="mt-1 text-sm text-muted">Sử dụng tài khoản được Phân hiệu cấp để tiếp tục.</p>

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

          <div className="mt-8 flex items-start gap-2 rounded-lg bg-white p-3 text-xs text-muted ring-1 ring-line">
            <LifeBuoy className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
            <span>
              Quên mật khẩu hoặc cần hỗ trợ kỹ thuật? Liên hệ quản trị hệ thống của Phân hiệu để được cấp lại.
              Sau lần đăng nhập đầu tiên, hãy đổi mật khẩu.
            </span>
          </div>
        </div>
      </section>
    </div>
  );
}
