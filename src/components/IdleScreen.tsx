"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

const IDLE_MS = 30_000; // 30 giây không thao tác
const EVENTS = ["mousemove", "mousedown", "keydown", "touchstart", "wheel", "scroll", "pointerdown"] as const;

// Vị trí / tốc độ cố định cho các hạt sáng (không dùng Math.random để giao diện ổn định)
const PARTICLES = Array.from({ length: 14 }, (_, i) => ({
  left: (i * 37 + 11) % 100,
  size: 2 + ((i * 7) % 4),
  delay: (i * 0.73) % 9,
  duration: 14 + ((i * 5) % 10),
  drift: ((i % 5) - 2) * 18,
}));

// Đốm sáng lớn, mờ trôi chậm phía sau
const BOKEH = Array.from({ length: 6 }, (_, i) => ({
  left: (i * 41 + 7) % 95,
  top: (i * 29 + 13) % 85,
  size: 120 + ((i * 37) % 160),
  delay: -((i * 1.9) % 14),
  duration: 22 + ((i * 3) % 12),
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
          {/* Hiệu ứng nền: lưới chấm trôi, tia sáng xoay, đốm sáng mờ, sóng */}
          <div className="idle-lines">
            {[1, 2, 3, 4, 5].map((n) => (
              <span key={n} style={{ width: `${n * 26}vmin`, height: `${n * 26}vmin`, animationDelay: `${-n * 1.6}s` }} />
            ))}
          </div>
          <div className="idle-rays" />
          {BOKEH.map((b, i) => (
            <span
              key={`b${i}`}
              className="idle-bokeh"
              style={{
                left: `${b.left}%`,
                top: `${b.top}%`,
                width: b.size,
                height: b.size,
                animationDelay: `${b.delay}s`,
                animationDuration: `${b.duration}s`,
              }}
            />
          ))}
          <svg className="idle-waves" viewBox="0 0 2880 220" preserveAspectRatio="none" aria-hidden="true">
            <path className="idle-wave idle-wave-1" d="M0,120 C240,60 480,180 720,120 C960,60 1200,180 1440,120 C1680,60 1920,180 2160,120 C2400,60 2640,180 2880,120" />
            <path className="idle-wave idle-wave-2" d="M0,150 C240,100 480,200 720,150 C960,100 1200,200 1440,150 C1680,100 1920,200 2160,150 C2400,100 2640,200 2880,150" />
            <path className="idle-wave idle-wave-3" d="M0,180 C240,150 480,210 720,180 C960,150 1200,210 1440,180 C1680,150 1920,210 2160,180 C2400,150 2640,210 2880,180" />
          </svg>

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
              className="idle-logo relative flex overflow-hidden h-44 w-44 items-center justify-center rounded-full bg-white p-3 sm:h-48 sm:w-48"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo-phan-hieu.png" alt="Logo Phân hiệu Thanh Hoá" className="h-full w-full object-contain" />
              <span className="idle-shine" aria-hidden="true" />
            </motion.span>
          </div>

          <motion.div
            initial={{ y: 16, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.35, duration: 0.6 }}
            className="relative mt-6 text-center"
          >
            <p className="text-6xl font-extralight tabular-nums tracking-[0.04em] sm:text-7xl">
              {time}
              <span className="ml-1.5 align-top text-xl font-light text-white/50 sm:text-2xl">{seconds}</span>
            </p>
            <p className="mt-3 text-sm font-light capitalize tracking-[0.12em] text-white/75 sm:text-base">{date}</p>
            <div className="mx-auto my-6 flex items-center justify-center gap-3">
              <span className="h-px w-16 bg-gradient-to-r from-transparent to-white/60" />
              <span className="h-1.5 w-1.5 rotate-45 bg-white/80" />
              <span className="h-px w-16 bg-gradient-to-l from-transparent to-white/60" />
            </div>
            <p className="text-[11px] font-medium uppercase tracking-[0.35em] text-white/70 sm:text-xs">Trường Đại học Y Hà Nội</p>
            <p className="mt-2 text-lg font-semibold uppercase tracking-[0.12em] sm:text-xl">Phân hiệu tại Thanh Hoá</p>
            <p className="mt-2 text-xs font-light tracking-[0.08em] text-white/60 sm:text-sm">Hệ thống quản lý và phân công công việc</p>
          </motion.div>

          <p className="idle-hint absolute bottom-[11vh] text-[11px] uppercase tracking-[0.3em] text-white/80">Di chuột hoặc nhấn phím bất kỳ để tiếp tục</p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
