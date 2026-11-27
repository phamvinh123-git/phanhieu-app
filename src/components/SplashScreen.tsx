/**
 * Màn hình chờ toàn trang: logo Phân hiệu, tên hệ thống và thanh tiến trình
 * chạy liên tục. Dùng khi mở app / sau khi đăng nhập (đang tải thông tin người
 * dùng) và làm loading.tsx gốc. Không dùng hook nên chạy được cả ở server.
 */
export function SplashScreen() {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Đang tải"
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-background"
    >
      <div className="relative flex h-24 w-24 items-center justify-center">
        <span className="splash-ring absolute inset-0 rounded-full border-2 border-red-200" />
        <span className="splash-ring absolute inset-0 rounded-full border-2 border-red-200 [animation-delay:0.9s]" />
        <span className="relative flex h-20 w-20 items-center justify-center rounded-full bg-white p-1.5 shadow-md ring-1 ring-line">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-phan-hieu.png" alt="" className="h-full w-full object-contain" />
        </span>
      </div>
      <p className="mt-6 text-lg font-bold tracking-wide text-red-700">HMU TaskFlow</p>
      <p className="mt-0.5 text-[13px] text-muted">Phân hiệu Trường Đại học Y Hà Nội tại Thanh Hoá</p>
      <div className="mt-6 h-1 w-40 overflow-hidden rounded-full bg-red-100">
        <div className="splash-bar h-full w-1/3 rounded-full bg-red-600" />
      </div>
    </div>
  );
}

/** Chờ trong vùng nội dung (sidebar + header vẫn giữ nguyên khi chuyển trang). */
export function ContentLoader() {
  return (
    <div role="status" aria-label="Đang tải" className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
      <span className="relative flex h-14 w-14 items-center justify-center">
        <span className="absolute inset-0 animate-spin rounded-full border-[3px] border-red-100 border-t-red-600" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-phan-hieu.png" alt="" className="h-9 w-9 object-contain" />
      </span>
      <span className="text-sm text-muted">Đang tải…</span>
    </div>
  );
}
