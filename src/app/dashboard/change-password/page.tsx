"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { KeyRound, CheckCircle2 } from "lucide-react";

export default function ChangePasswordPage() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    if (newPassword !== confirmPassword) {
      setError("Mật khẩu mới nhập lại không khớp");
      return;
    }
    if (newPassword.length < 8) {
      setError("Mật khẩu mới phải có ít nhất 8 ký tự");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/me/password", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Có lỗi xảy ra");
        return;
      }
      setSuccess(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch {
      setError("Không thể kết nối tới máy chủ");
    } finally {
      setLoading(false);
    }
  }

  const inputCls = "field";

  return (
    <div className="max-w-md">
      <motion.h1
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-3 text-2xl font-bold text-ink"
      >
        <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-50 text-red-600">
          <KeyRound className="h-4.5 w-4.5" />
        </span>
        Đổi mật khẩu
      </motion.h1>
      <p className="mt-1 pl-[52px] text-sm text-muted">
        Nếu đây là lần đăng nhập đầu tiên bằng mật khẩu khởi tạo chung, bạn nên đổi ngay sang
        mật khẩu riêng của mình.
      </p>

      <motion.form
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.08 }}
        onSubmit={onSubmit}
        className="todo-card mt-6 space-y-4 p-6"
      >
        <div>
          <label className="field-label">Mật khẩu hiện tại</label>
          <input
            type="password"
            required
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            className={inputCls}
          />
        </div>
        <div>
          <label className="field-label">Mật khẩu mới</label>
          <input
            type="password"
            required
            minLength={8}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className={inputCls}
          />
          <p className="mt-1 text-xs text-slate-400">Ít nhất 8 ký tự.</p>
        </div>
        <div>
          <label className="field-label">Nhập lại mật khẩu mới</label>
          <input
            type="password"
            required
            minLength={8}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className={inputCls}
          />
        </div>

        <AnimatePresence mode="wait">
          {error && (
            <motion.p
              key="err"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="text-sm text-red-600"
            >
              {error}
            </motion.p>
          )}
          {success && (
            <motion.p
              key="ok"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-1.5 text-sm text-done"
            >
              <CheckCircle2 className="h-4 w-4 animate-check-pop" />
              Đổi mật khẩu thành công.
            </motion.p>
          )}
        </AnimatePresence>

        <motion.button
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.98 }}
          type="submit"
          disabled={loading}
          className="btn btn-primary w-full"
        >
          {loading ? "Đang lưu..." : "Đổi mật khẩu"}
        </motion.button>
      </motion.form>
    </div>
  );
}
