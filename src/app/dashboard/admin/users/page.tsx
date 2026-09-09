"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Plus, X, Trash2, Pencil, Users as UsersIcon } from "lucide-react";
import { ModalShell } from "@/components/ModalShell";
import { ROLE_CODES, ROLE_LABELS, ROLE_SCOPE, type RoleCode } from "@/lib/rbac-config";

type UserRow = {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
  isActive: boolean;
  roles: { role: RoleCode; departmentId: number | null }[];
};

type Department = { id: number; name: string };
type RoleRow = { role: RoleCode; departmentId?: number };

const inputCls =
  "w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none transition-colors focus:border-red-400 focus:ring-1 focus:ring-red-200";

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editingUser, setEditingUser] = useState<UserRow | null>(null);

  function load() {
    setLoading(true);
    Promise.all([
      fetch("/api/admin/users").then((r) => r.json()),
      fetch("/api/org").then((r) => r.json()),
    ])
      .then(([u, o]) => {
        setUsers(u.users ?? []);
        setDepartments(o.departments ?? []);
      })
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  const deptName = (id: number | null) => departments.find((d) => d.id === id)?.name ?? "";

  return (
    <div>
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Quản lý người dùng &amp; Bảng phân quyền</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            Một người có thể được cấp nhiều vai trò cùng lúc (ví dụ vừa là Trưởng phòng A, vừa hỗ trợ phòng B).
          </p>
        </div>
        <motion.button
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          onClick={() => setShowCreate(true)}
          className="flex shrink-0 items-center gap-1.5 rounded-xl bg-red-600 px-3.5 py-2.5 text-sm font-medium text-white shadow-sm shadow-red-600/20 hover:bg-red-700"
        >
          <Plus className="h-4 w-4" /> Cấp tài khoản
        </motion.button>
      </div>

      {loading ? (
        <div className="todo-card h-64 animate-pulse bg-slate-100/70" />
      ) : (
        <div className="todo-card overflow-x-auto p-0">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2.5">Họ tên</th>
                <th className="px-4 py-2.5">Email</th>
                <th className="px-4 py-2.5">Vai trò</th>
                <th className="px-4 py-2.5">Trạng thái</th>
                <th className="px-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              <AnimatePresence initial={false}>
                {users.map((u, i) => (
                  <motion.tr
                    key={u.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.02 }}
                    className="transition-colors hover:bg-red-50/30"
                  >
                    <td className="px-4 py-3 font-medium text-slate-800">{u.fullName}</td>
                    <td className="px-4 py-3 text-slate-500">{u.email}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1.5">
                        {u.roles.map((r, ri) => (
                          <span
                            key={ri}
                            className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700"
                          >
                            {ROLE_LABELS[r.role]}
                            {r.departmentId && ` · ${deptName(r.departmentId)}`}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          u.isActive ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-500"
                        }`}
                      >
                        {u.isActive ? "Đang hoạt động" : "Đã khoá"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => setEditingUser(u)}
                        className="inline-flex items-center gap-1 text-xs font-medium text-red-600 transition-colors hover:text-red-800"
                      >
                        <Pencil className="h-3.5 w-3.5" /> Sửa phân quyền
                      </button>
                    </td>
                  </motion.tr>
                ))}
              </AnimatePresence>
            </tbody>
          </table>
          {users.length === 0 && (
            <div className="flex flex-col items-center gap-2 p-10 text-center">
              <UsersIcon className="h-6 w-6 text-slate-300" />
              <p className="text-sm text-slate-400">Chưa có tài khoản nào.</p>
            </div>
          )}
        </div>
      )}

      <AnimatePresence>
        {showCreate && (
          <CreateUserModal
            departments={departments}
            onClose={() => setShowCreate(false)}
            onCreated={() => {
              setShowCreate(false);
              load();
            }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {editingUser && (
          <EditUserModal
            user={editingUser}
            departments={departments}
            onClose={() => setEditingUser(null)}
            onSaved={() => {
              setEditingUser(null);
              load();
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Bảng chọn vai trò dùng chung cho form Tạo mới và Sửa
// ---------------------------------------------------------------------------

function RoleRowsEditor({
  roleRows,
  setRoleRows,
  departments,
}: {
  roleRows: RoleRow[];
  setRoleRows: React.Dispatch<React.SetStateAction<RoleRow[]>>;
  departments: Department[];
}) {
  function updateRole(idx: number, patch: Partial<RoleRow>) {
    setRoleRows((rows) => rows.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  }

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <label className="text-xs font-medium text-slate-600">Vai trò được cấp (có thể chọn nhiều)</label>
        <button
          type="button"
          onClick={() => setRoleRows((r) => [...r, { role: "truong_phong" }])}
          className="text-xs font-medium text-red-600 hover:text-red-800"
        >
          + Thêm vai trò
        </button>
      </div>
      <div className="space-y-2">
        <AnimatePresence initial={false}>
          {roleRows.map((row, idx) => {
            const scopeKind = ROLE_SCOPE[row.role];
            return (
              <motion.div
                key={idx}
                layout
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96 }}
                className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 p-2"
              >
                <select
                  value={row.role}
                  onChange={(e) => updateRole(idx, { role: e.target.value as RoleCode, departmentId: undefined })}
                  className="rounded-lg border border-slate-200 px-2 py-1 text-xs outline-none focus:border-red-400"
                >
                  {ROLE_CODES.map((rc) => (
                    <option key={rc} value={rc}>
                      {ROLE_LABELS[rc]}
                    </option>
                  ))}
                </select>

                {scopeKind === "department" && (
                  <select
                    required
                    value={row.departmentId ?? ""}
                    onChange={(e) => updateRole(idx, { departmentId: Number(e.target.value) })}
                    className="min-w-[140px] flex-1 rounded-lg border border-slate-200 px-2 py-1 text-xs outline-none focus:border-red-400"
                  >
                    <option value="">-- Chọn phòng --</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                )}
                {scopeKind === "none" && <span className="flex-1 text-xs text-slate-400">Phạm vi toàn Phân Hiệu</span>}

                {roleRows.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setRoleRows((rows) => rows.filter((_, i) => i !== idx))}
                    className="text-slate-300 transition-colors hover:text-red-500"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Modal: cấp tài khoản mới
// ---------------------------------------------------------------------------

function CreateUserModal({
  departments,
  onClose,
  onCreated,
}: {
  departments: Department[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [roleRows, setRoleRows] = useState<RoleRow[]>([{ role: "truong_phong" }]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fullName, email, password, roles: roleRows }),
    });
    setSaving(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Không thể tạo tài khoản");
      return;
    }
    onCreated();
  }

  return (
    <ModalShell onClose={onClose} maxWidth="max-w-lg">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-base font-semibold text-slate-900">Cấp tài khoản mới</h2>
        <button onClick={onClose} className="text-slate-400 transition-colors hover:text-slate-600">
          <X className="h-5 w-5" />
        </button>
      </div>

      <form onSubmit={submit} className="space-y-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Họ và tên</label>
            <input required value={fullName} onChange={(e) => setFullName(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Email đăng nhập</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputCls}
            />
          </div>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Mật khẩu ban đầu</label>
          <input
            type="text"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputCls}
          />
        </div>

        <RoleRowsEditor roleRows={roleRows} setRoleRows={setRoleRows} departments={departments} />

        <AnimatePresence>
          {error && (
            <motion.p
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="rounded-xl bg-red-50 px-3 py-2 text-xs text-red-600"
            >
              {error}
            </motion.p>
          )}
        </AnimatePresence>

        <motion.button
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.98 }}
          type="submit"
          disabled={saving}
          className="w-full rounded-xl bg-red-600 px-3 py-2.5 text-sm font-medium text-white shadow-sm shadow-red-600/20 hover:bg-red-700 disabled:opacity-60"
        >
          {saving ? "Đang lưu..." : "Cấp tài khoản"}
        </motion.button>
      </form>
    </ModalShell>
  );
}

// ---------------------------------------------------------------------------
// Modal: sửa phân quyền của tài khoản đã có
// ---------------------------------------------------------------------------

function EditUserModal({
  user,
  departments,
  onClose,
  onSaved,
}: {
  user: UserRow;
  departments: Department[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [roleRows, setRoleRows] = useState<RoleRow[]>(
    user.roles.map((r) => ({ role: r.role, departmentId: r.departmentId ?? undefined }))
  );
  const [isActive, setIsActive] = useState(user.isActive);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const res = await fetch(`/api/admin/users/${user.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roles: roleRows, isActive }),
    });
    setSaving(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Không thể lưu thay đổi");
      return;
    }
    onSaved();
  }

  return (
    <ModalShell onClose={onClose} maxWidth="max-w-lg">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Sửa phân quyền</h2>
          <p className="text-xs text-slate-500">
            {user.fullName} · {user.email}
          </p>
        </div>
        <button onClick={onClose} className="text-slate-400 transition-colors hover:text-slate-600">
          <X className="h-5 w-5" />
        </button>
      </div>

      <form onSubmit={submit} className="space-y-3">
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
          Tài khoản đang hoạt động (bỏ chọn để khoá đăng nhập)
        </label>

        <RoleRowsEditor roleRows={roleRows} setRoleRows={setRoleRows} departments={departments} />

        <AnimatePresence>
          {error && (
            <motion.p
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="rounded-xl bg-red-50 px-3 py-2 text-xs text-red-600"
            >
              {error}
            </motion.p>
          )}
        </AnimatePresence>

        <motion.button
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.98 }}
          type="submit"
          disabled={saving}
          className="w-full rounded-xl bg-red-600 px-3 py-2.5 text-sm font-medium text-white shadow-sm shadow-red-600/20 hover:bg-red-700 disabled:opacity-60"
        >
          {saving ? "Đang lưu..." : "Lưu thay đổi"}
        </motion.button>
      </form>
    </ModalShell>
  );
}
