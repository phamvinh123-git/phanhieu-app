import type { Metadata } from "next";
// Phông chữ Be Vietnam Pro — thiết kế riêng cho tiếng Việt, tự lưu trữ file
// phông (qua @fontsource) để hiển thị giống hệt nhau trên mọi máy/trình duyệt.
import "@fontsource/be-vietnam-pro/400.css";
import "@fontsource/be-vietnam-pro/500.css";
import "@fontsource/be-vietnam-pro/600.css";
import "@fontsource/be-vietnam-pro/700.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Hệ thống Quản lý & Phân công công việc — Phân Hiệu Y Hà Nội tại Thanh Hóa",
  description: "Phân bổ, theo dõi và báo cáo tiến độ công việc theo mô hình Kanban",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="vi" data-scroll-behavior="smooth" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-slate-50 text-slate-900">{children}</body>
    </html>
  );
}
