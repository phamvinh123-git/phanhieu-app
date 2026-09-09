import type { Metadata } from "next";
// Phông chữ serif cổ điển kiểu văn bản hành chính — cùng tinh thần với các
// phần mềm điều hành tác nghiệp (eOffice...) vẫn dùng Times New Roman cho
// toàn bộ giao diện. Dùng Tinos (tương thích kích thước với Times New
// Roman, có sẵn bộ dấu tiếng Việt đầy đủ) và tự lưu trữ file phông (qua
// @fontsource) để hiển thị đúng và giống hệt nhau trên mọi máy/trình
// duyệt, không phụ thuộc phông Times New Roman có sẵn hay không trên máy
// người dùng.
import "@fontsource/tinos/400.css";
import "@fontsource/tinos/700.css";
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
