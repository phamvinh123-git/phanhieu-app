import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Hệ thống Quản lý & Phân công công việc — Phân hiệu Y Hà Nội tại Thanh Hóa",
  description: "Phân bổ, theo dõi và báo cáo tiến độ công việc theo mô hình Kanban",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="vi" data-scroll-behavior="smooth" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-slate-50 text-slate-900">{children}</body>
    </html>
  );
}
