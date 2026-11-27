"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Plus, X, Trash2, Pencil, Search, Users as UsersIcon } from "lucide-react";
import { PageHeader, EmptyState } from "@/components/ui";
import { initials } from "@/components/layout/AppShell";
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

const inputCls = "field";

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editingUser, setEditingUser] = useState<UserRow | null>(null);
  const [query, setQuery] = useState("");

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

  const q = query.trim().toLowerCase();
  const visible = users.filter(
    (u) => !q || u.fullName.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
  );

  return (
    <div>
      <PageHeader
        title="Quản lý người dùng"
        actions={
          <button onClick={() => setShowCreate(true)} className="btn btn-primary">
            <Plus className="h-4 w-4" /> Cấp tài khoản
          </button>
        }
      />

      <div className="todo-card overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 border-b border-line p-4">
          <div className="relative w-full sm:w-80">
            <label htmlFor="user-search" className="sr-only">Tìm người dùng</label>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              id="user-search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Tìm theo họ tên hoặc email"
              className="field pl-9"
            />
          </div>
          {!loading && (
            <span className="text-[13px] tabular-nums text-muted">
              {visible.length}/{users.length} tài khoản
            </span>
          )}
        </div>

        {loading ? (
          <div className="space-y-2 p-4">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="h-12 animate-pulse rounded-lg bg-slate-100" />
            ))}
          </div>
        ) : visible.length === 0 ? (
          <EmptyState
            icon={UsersIcon}
            title={users.length === 0 ? "Chưa có tài khoản nào" : "Không tìm thấy người dùng phù hợp"}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table min-w-[760px]">
              <thead>
                <tr>
                  <th>Người dùng</th>
                  <th>Đơn vị</th>
                  <th>Vai trò</th>
                  <th>Trạng thái</th>
                  <th className="text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((u) => {
                  const units = [...new Set(u.roles.map((r) => deptName(r.departmentId)).filter(Boolean))];
                  return (
                    <tr key={u.id}>
                      <td>
                        <div className="flex items-center gap-3">
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-50 text-sm font-semibold text-red-700">
                            {initials(u.fullName)}
                          </span>
                          <div className="min-w-0">
                            <p className="truncate font-medium text-ink">{u.fullName}</p>
                            <p className="truncate text-xs text-muted">{u.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="max-w-[220px] text-muted">{units.length ? units.join(", ") : "Toàn Phân hiệu"}</td>
                      <td>
                        <div className="flex flex-wrap gap-1.5">
                          {u.roles.map((r, ri) => (
                            <span key={ri} className="badge badge-brand">
                              {ROLE_LABELS[r.role]}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td>
                        <span className={`badge ${u.isActive ? "badge-done" : "badge-neutral"}`}>
                          {u.isActive ? "Đang hoạt động" : "Đã khoá"}
                        </span>
                      </td>
                      <td className="text-right">
                        <button onClick={() => setEditingUser(u)} className="btn btn-soft btn-sm">
                          <Pencil className="h-3.5 w-3.5" /> Sửa phân quyền
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

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
        <label className="field-label mb-0">Vai trò được cấp (có thể chọn nhiều)</label>
        <button
          type="button"
          onClick={() => setRoleRows((r) => [...r, { role: "truong_phong" }])}
          className="btn btn-soft btn-sm"
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
                className="flex flex-wrap items-center gap-2 rounded-lg border border-line p-2"
              >
                <select
                  value={row.role}
                  onChange={(e) => updateRole(idx, { role: e.target.value as RoleCode, departmentId: undefined })}
                  className="field h-9 w-auto text-[13px]"
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
                    className="field h-9 min-w-[160px] flex-1 text-[13px]"
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
        <h2 className="text-lg font-semibold text-ink">Cấp tài khoản mới</h2>
        <button onClick={onClose} aria-label="Đóng" className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600">
          <X className="h-5 w-5" />
        </button>
      </div>

      <form onSubmit={submit} className="space-y-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="field-label">Họ và tên</label>
            <input required value={fullName} onChange={(e) => setFullName(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="field-label">Email đăng nhập</label>
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
          <label className="field-label">Mật khẩu ban đầu</label>
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
              className="rounded-lg bg-[#FEF2F2] px-3 py-2 text-sm text-[#B91C1C]"
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
          className="btn btn-primary w-full"
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
          <h2 className="text-lg font-semibold text-ink">Sửa phân quyền</h2>
          <p className="text-xs text-slate-500">
            {user.fullName} · {user.email}
          </p>
        </div>
        <button onClick={onClose} aria-label="Đóng" className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600">
          <X className="h-5 w-5" />
        </button>
      </div>

      <form onSubmit={submit} className="space-y-3">
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="h-4 w-4" />
          Tài khoản đang hoạt động (bỏ chọn để khoá đăng nhập)
        </label>

        <RoleRowsEditor roleRows={roleRows} setRoleRows={setRoleRows} departments={departments} />

        <AnimatePresence>
          {error && (
            <motion.p
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="rounded-lg bg-[#FEF2F2] px-3 py-2 text-sm text-[#B91C1C]"
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
          className="btn btn-primary w-full"
        >
          {saving ? "Đang lưu..." : "Lưu thay đổi"}
        </motion.button>
      </form>
    </ModalShell>
  );
}
