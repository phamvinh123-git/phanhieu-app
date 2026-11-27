"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Plus, X, Trash2, Pencil, Search, Lock, LockOpen, Users as UsersIcon } from "lucide-react";
import { useMe } from "@/components/MeProvider";
import { PageHeader, EmptyState } from "@/components/ui";
import { initials } from "@/components/layout/AppShell";
import { ModalShell } from "@/components/ModalShell";
import { ROLE_CODES, ROLE_LABELS, ROLE_SCOPE, roleLabel, type RoleCode } from "@/lib/rbac-config";

type UserRow = {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
  isActive: boolean;
  roles: { role: RoleCode; departmentId: number | null; acting?: boolean; expiresAt?: string | null }[];
};

type Department = { id: number; name: string };
type RoleRow = { role: RoleCode; departmentId?: number; acting?: boolean; expiresAt?: string };

/** Ngày hôm nay (giờ VN) yyyy-mm-dd */
function todayYmd() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }).format(new Date());
}
const ymd = (d?: string | null) => (d ? d.slice(0, 10) : "");
const vnDate = (d?: string | null) => (d ? ymd(d).split("-").reverse().join("/") : "");
const roleExpired = (r: { expiresAt?: string | null }) => Boolean(r.expiresAt && ymd(r.expiresAt) < todayYmd());

const inputCls = "field";

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editingUser, setEditingUser] = useState<UserRow | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"" | "active" | "locked">("");
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const { me } = useMe();

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
    (u) =>
      (!q || u.fullName.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)) &&
      (!statusFilter || (statusFilter === "active" ? u.isActive : !u.isActive))
  );
  const activeCount = users.filter((u) => u.isActive).length;

  async function toggleActive(u: UserRow) {
    const next = !u.isActive;
    const ok = window.confirm(
      next
        ? `Mở khoá tài khoản ${u.fullName}? Người này sẽ đăng nhập và làm việc lại được.`
        : `Tạm khoá tài khoản ${u.fullName}? Người này sẽ bị đăng xuất và không đăng nhập được cho đến khi được mở khoá. Dữ liệu công việc vẫn được giữ nguyên.`
    );
    if (!ok) return;
    setTogglingId(u.id);
    setActionError(null);
    const res = await fetch(`/api/admin/users/${u.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: next }),
    });
    setTogglingId(null);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setActionError(data.error ?? "Không thể cập nhật trạng thái");
      return;
    }
    setUsers((list) => list.map((x) => (x.id === u.id ? { ...x, isActive: next } : x)));
  }

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
          <div className="w-full sm:w-52">
            <label htmlFor="user-status" className="sr-only">Lọc theo trạng thái</label>
            <select
              id="user-status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as "" | "active" | "locked")}
              className="field"
            >
              <option value="">Tất cả trạng thái</option>
              <option value="active">Đang hoạt động</option>
              <option value="locked">Tạm khoá</option>
            </select>
          </div>
          {!loading && (
            <span className="text-[13px] tabular-nums text-muted">
              {activeCount} đang hoạt động · {users.length - activeCount} tạm khoá
            </span>
          )}
        </div>
        {actionError && (
          <div role="alert" className="border-b border-line bg-[#FEF2F2] px-4 py-2 text-sm text-[#B91C1C]">
            {actionError}
          </div>
        )}

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
            <table className="data-table min-w-[900px]">
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
                    <tr key={u.id} className={u.isActive ? "" : "[&>td:not(:last-child)]:opacity-50"}>
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
                      <td className="min-w-[160px] max-w-[220px] text-muted">{units.length ? units.join(", ") : "Toàn Phân hiệu"}</td>
                      <td>
                        <div className="flex flex-wrap gap-1.5">
                          {u.roles.map((r, ri) => (
                            <span key={ri} className="inline-flex flex-col items-start">
                              <span className={`badge ${roleExpired(r) ? "badge-neutral line-through" : "badge-brand"}`}>
                                {roleLabel(r.role, r.acting)}
                              </span>
                              {r.expiresAt && (
                                <span className={`mt-0.5 pl-1 text-[11px] ${roleExpired(r) ? "text-overdue" : "text-muted"}`}>
                                  {roleExpired(r) ? "Hết hạn" : "Đến"} {vnDate(r.expiresAt)}
                                </span>
                              )}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td>
                        <span className={`badge ${u.isActive ? "badge-done" : "badge-overdue"}`}>
                          {u.isActive
                            ? "Đang hoạt động"
                            : u.roles.length > 0 && u.roles.every(roleExpired)
                              ? "Hết thời hạn quyền"
                              : "Tạm khoá"}
                        </span>
                      </td>
                      <td className="text-right">
                        <div className="flex justify-end gap-2">
                          <button onClick={() => setEditingUser(u)} className="btn btn-soft btn-sm">
                            <Pencil className="h-3.5 w-3.5" /> Sửa phân quyền
                          </button>
                          {u.id !== me?.user?.id &&
                            (u.isActive ? (
                              <button
                                onClick={() => toggleActive(u)}
                                disabled={togglingId === u.id}
                                className="btn btn-danger btn-sm w-[104px]"
                              >
                                <Lock className="h-3.5 w-3.5" /> Tạm khoá
                              </button>
                            ) : (
                              <button
                                onClick={() => toggleActive(u)}
                                disabled={togglingId === u.id}
                                className="btn btn-secondary btn-sm w-[104px]"
                              >
                                <LockOpen className="h-3.5 w-3.5" /> Mở khoá
                              </button>
                            ))}
                        </div>
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

                <div className="flex w-full flex-wrap items-center gap-x-4 gap-y-2 border-t border-line pt-2">
                  <label className="flex items-center gap-2 text-[13px] text-ink">
                    <input
                      type="checkbox"
                      checked={Boolean(row.acting)}
                      onChange={(e) => updateRole(idx, { acting: e.target.checked })}
                      className="h-4 w-4"
                    />
                    Quyền (giữ quyền tạm thời)
                  </label>
                  <label className="flex items-center gap-2 text-[13px] text-muted">
                    Hiệu lực đến
                    <input
                      type="date"
                      min={todayYmd()}
                      value={row.expiresAt ?? ""}
                      onChange={(e) => updateRole(idx, { expiresAt: e.target.value || undefined })}
                      className="field h-9 w-auto text-[13px]"
                    />
                  </label>
                  {row.expiresAt && (
                    <button
                      type="button"
                      onClick={() => updateRole(idx, { expiresAt: undefined })}
                      className="text-xs text-muted hover:text-red-700"
                    >
                      Bỏ thời hạn
                    </button>
                  )}
                  {roleExpired(row) && <span className="text-xs font-medium text-overdue">Đã hết hạn — chọn ngày mới để gia hạn</span>}
                </div>

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
    user.roles.map((r) => ({
      role: r.role,
      departmentId: r.departmentId ?? undefined,
      acting: Boolean(r.acting),
      expiresAt: r.expiresAt ? ymd(r.expiresAt) : undefined,
    }))
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
          Tài khoản đang hoạt động (bỏ chọn để tạm khoá)
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
