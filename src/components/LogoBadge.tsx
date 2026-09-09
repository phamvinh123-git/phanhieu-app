"use client";

/**
 * Huy hiệu logo hình tròn có hiệu ứng "lấp lánh": một vòng sáng xoay quanh
 * viền (kiểu conic-gradient xoay chậm) cùng vài đốm sao nhỏ nhấp nháy xung
 * quanh. Dùng chung cho mọi nơi hiển thị logo (Sidebar, trang đăng nhập) để
 * đồng nhất và dễ chỉnh sửa về sau.
 */

import Image from "next/image";

const SIZE_MAP = {
  sm: { box: 32, img: 24, pad: "p-1", sparkle: 7, ringInset: -3 },
  md: { box: 40, img: 32, pad: "p-1.5", sparkle: 8, ringInset: -3 },
  lg: { box: 80, img: 68, pad: "p-2", sparkle: 13, ringInset: -5 },
} as const;

export function LogoBadge({ size = "md" }: { size?: keyof typeof SIZE_MAP }) {
  const s = SIZE_MAP[size];

  return (
    <div className="relative shrink-0" style={{ width: s.box, height: s.box }}>
      {/* Vòng sáng xoay quanh viền — hiệu ứng lấp lánh */}
      <div
        className="pointer-events-none absolute animate-logo-ring rounded-full"
        style={{
          inset: s.ringInset,
          background:
            "conic-gradient(from 0deg, transparent 0%, rgba(253,224,71,0.9) 10%, rgba(255,255,255,0.95) 20%, rgba(253,224,71,0.9) 30%, transparent 42%, transparent 100%)",
        }}
      />

      {/* Thân logo hình tròn */}
      <div
        className={`relative flex h-full w-full items-center justify-center rounded-full bg-white ${s.pad} shadow-lg ring-1 ring-red-100`}
      >
        <Image
          src="/logo.png"
          alt="Logo Phân Hiệu Thanh Hóa"
          width={s.img}
          height={s.img}
          className="h-full w-full rounded-full object-contain"
        />
      </div>

      {/* Các đốm sao lấp lánh quanh logo */}
      <SparkleDot size={s.sparkle} className="-right-1 -top-1" delay="0s" />
      <SparkleDot size={s.sparkle * 0.7} className="-bottom-0.5 -left-1" delay="0.6s" />
      <SparkleDot size={s.sparkle * 0.55} className="top-1/2 -right-2" delay="1.2s" />
    </div>
  );
}

function SparkleDot({
  size,
  className,
  delay,
}: {
  size: number;
  className: string;
  delay: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={`pointer-events-none absolute animate-logo-twinkle text-amber-300 drop-shadow-[0_0_2px_rgba(255,255,255,0.9)] ${className}`}
      style={{ width: size, height: size, animationDelay: delay }}
    >
      <path d="M12 0c0 5.523 1.477 7 7 7-5.523 0-7 1.477-7 7 0-5.523-1.477-7-7-7 5.523 0 7-1.477 7-7z" />
    </svg>
  );
}
