"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

const IDLE_MS = 30_000; // 30 giây không thao tác
const EVENTS = ["mousemove", "mousedown", "keydown", "touchstart", "wheel", "scroll", "pointerdown"] as const;

// Vị trí / tốc độ cố định cho các hạt sáng (không dùng Math.random để giao diện ổn định)
const PARTICLES = Array.from({ length: 22 }, (_, i) => ({
  left: (i * 37 + 11) % 100,
  size: 3 + ((i * 7) % 6),
  delay: (i * 0.73) % 9,
  duration: 9 + ((i * 5) % 8),
  drift: ((i % 5) - 2) * 18,
}));

function useClock(active: boolean) {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    if (!active) return;
    const tick = () => setNow(new Date());
    const first = setTimeout(tick, 0);
    const t = setInterval(tick, 1000);
    return () => {
      clearTimeout(first);
      clearInterval(t);
    };
  }, [active]);
  return now;
}

/**
 * Màn hình chờ: sau 30 giây không thao tác thì hiện logo Phân hiệu với hiệu ứng
 * đỏ – trắng; di chuột / chạm / nhấn phím bất kỳ để quay lại đúng trang đang làm.
 */
export function IdleScreen() {
  const [idle, setIdle] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const shownAt = useRef(0);
  const now = useClock(idle);

  useEffect(() => {
    const arm = () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        // Không bật khi tab đang ẩn hoặc đang in
        if (document.visibilityState === "visible") {
          shownAt.current = Date.now();
          setIdle(true);
        }
      }, IDLE_MS);
    };
    const onActivity = () => {
      // Bỏ qua rung chuột ngay lúc vừa hiện để màn hình chờ không tắt ngay
      if (Date.now() - shownAt.current < 400) return;
      setIdle(false);
      arm();
    };
    EVENTS.forEach((e) => window.addEventListener(e, onActivity, { passive: true, capture: true }));
    document.addEventListener("visibilitychange", onActivity);
    arm();
    return () => {
      if (timer.current) clearTimeout(timer.current);
      EVENTS.forEach((e) => window.removeEventListener(e, onActivity, { capture: true }));
      document.removeEventListener("visibilitychange", onActivity);
    };
  }, []);

  const time = now?.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }) ?? "";
  const seconds = now ? String(now.getSeconds()).padStart(2, "0") : "";
  const date = now?.toLocaleDateString("vi-VN", { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric" }) ?? "";

  return (
    <AnimatePresence>
      {idle && (
        <motion.div
          key="idle"
          role="dialog"
          aria-label="Màn hình chờ — di chuột hoặc nhấn phím bất kỳ để tiếp tục"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          onClick={() => setIdle(false)}
          className="idle-screen fixed inset-0 z-[200] flex cursor-none flex-col items-center justify-center overflow-hidden text-white print:hidden"
        >
          {/* Quầng sáng nền */}
          <div className="idle-glow idle-glow-1" />
          <div className="idle-glow idle-glow-2" />

          {/* Hạt sáng bay lên */}
          {PARTICLES.map((p, i) => (
            <span
              key={i}
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

          {/* Logo + vòng hiệu ứng */}
          <div className="relative flex h-72 w-72 items-center justify-center sm:h-80 sm:w-80">
            <span className="idle-ripple" />
            <span className="idle-ripple" style={{ animationDelay: "1.3s" }} />
            <span className="idle-ripple" style={{ animationDelay: "2.6s" }} />
            <span className="idle-ring" />
            <span className="idle-orbit">
              <i />
              <i />
              <i />
            </span>
            <motion.span
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 120, damping: 14, delay: 0.15 }}
              className="idle-logo relative flex h-44 w-44 items-center justify-center rounded-full bg-white p-3 sm:h-48 sm:w-48"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo-phan-hieu.png" alt="Logo Phân hiệu Thanh Hoá" className="h-full w-full object-contain" />
            </motion.span>
          </div>

          <motion.div
            initial={{ y: 16, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.35, duration: 0.6 }}
            className="relative mt-6 text-center"
          >
            <p className="text-6xl font-bold tabular-nums tracking-tight sm:text-7xl">
              {time}
              <span className="ml-1 align-top text-2xl font-semibold text-white/60 sm:text-3xl">{seconds}</span>
            </p>
            <p className="mt-2 text-base capitalize text-white/80 sm:text-lg">{date}</p>
            <div className="mx-auto my-5 h-px w-40 bg-gradient-to-r from-transparent via-white/60 to-transparent" />
            <p className="text-lg font-semibold sm:text-xl">Phân hiệu Trường Đại học Y Hà Nội tại Thanh Hoá</p>
            <p className="mt-1 text-sm text-white/70">Hệ thống quản lý và phân công công việc</p>
          </motion.div>

          <p className="idle-hint absolute bottom-8 text-sm text-white/70">Di chuột hoặc nhấn phím bất kỳ để tiếp tục</p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
