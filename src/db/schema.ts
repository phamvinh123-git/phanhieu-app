import {
  pgTable,
  pgEnum,
  serial,
  text,
  varchar,
  boolean,
  timestamp,
  integer,
  uuid,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

// 4 vai trò của hệ thống. Một người dùng có thể sở hữu NHIỀU dòng trong
// user_roles (ví dụ vừa là Trưởng phòng A, vừa hỗ trợ như Trưởng phòng B).
export const roleCodeEnum = pgEnum("role_code", [
  "admin", // Quản trị hệ thống
  "bgd", // Ban Giám Đốc
  "tkph", // Thư ký Phân Hiệu
  "truong_phong", // Trưởng phòng
]);

export const taskLevelEnum = pgEnum("task_level", [
  "branch", // Nhiệm vụ cấp Phân Hiệu (từ biên bản họp, TKPH giao cho Phòng)
  "department", // Nhiệm vụ cấp Phòng (Trưởng phòng tự chia nhỏ & tự quản lý)
]);

export const taskStatusEnum = pgEnum("task_status", [
  "todo", // Cần làm
  "in_progress", // Đang thực hiện
  "done", // Hoàn thành
]);

export const priorityEnum = pgEnum("priority", ["low", "normal", "high", "urgent"]);

export const meetingStatusEnum = pgEnum("meeting_status", ["draft", "reviewed"]);

// ---------------------------------------------------------------------------
// Cơ cấu tổ chức
// ---------------------------------------------------------------------------

export const departments = pgTable("departments", {
  id: serial("id").primaryKey(),
  code: varchar("code", { length: 32 }).notNull().unique(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ---------------------------------------------------------------------------
// Người dùng & phân quyền
// ---------------------------------------------------------------------------

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  fullName: text("full_name").notNull(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  phone: varchar("phone", { length: 32 }),
  passwordHash: text("password_hash").notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Một dòng = một "vai trò trong một phạm vi" của một người.
// - admin, bgd, tkph: departmentId = null (phạm vi toàn Phân Hiệu)
// - truong_phong: departmentId bắt buộc (phạm vi 1 phòng cụ thể)
export const userRoles = pgTable("user_roles", {
  id: serial("id").primaryKey(),
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  role: roleCodeEnum("role").notNull(),
  departmentId: integer("department_id").references(() => departments.id, {
    onDelete: "cascade",
  }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ---------------------------------------------------------------------------
// Biên bản họp chủ chốt
// ---------------------------------------------------------------------------

export const meetings = pgTable("meetings", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  meetingDate: timestamp("meeting_date").notNull(),
  content: text("content"), // nội dung / trích yếu biên bản
  status: meetingStatusEnum("status").default("draft").notNull(),
  createdBy: uuid("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ---------------------------------------------------------------------------
// Công việc (2 cấp, phân rã dạng cây qua parentTaskId)
// ---------------------------------------------------------------------------

export const tasks = pgTable("tasks", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  level: taskLevelEnum("level").notNull(),
  status: taskStatusEnum("status").default("todo").notNull(),
  priority: priorityEnum("priority").default("normal").notNull(),

  parentTaskId: integer("parent_task_id"),
  meetingId: integer("meeting_id").references(() => meetings.id, {
    onDelete: "set null",
  }),

  // Nhiệm vụ cấp Phòng luôn gắn với đúng 1 Phòng (cột này bắt buộc ở cấp đó).
  // Nhiệm vụ cấp Phân Hiệu có thể liên quan NHIỀU Phòng cùng lúc — phạm vi
  // thật sự của nó nằm ở bảng task_departments bên dưới; cột này để trống
  // (null) đối với nhiệm vụ cấp Phân Hiệu.
  departmentId: integer("department_id").references(() => departments.id, {
    onDelete: "cascade",
  }),

  createdBy: uuid("created_by").references(() => users.id),
  dueDate: timestamp("due_date"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Nhiệm vụ cấp Phân Hiệu <-> Phòng ban liên quan (nhiều-nhiều). Một nhiệm vụ
// gắn với nhiều Phòng nghĩa là các Phòng đó CÙNG phối hợp thực hiện — mọi
// Trưởng phòng liên quan đều thấy chung 1 thẻ việc trong Kanban của mình,
// dùng chung 1 trạng thái, và ai cũng có thể cập nhật/bình luận.
export const taskDepartments = pgTable("task_departments", {
  id: serial("id").primaryKey(),
  taskId: integer("task_id")
    .references(() => tasks.id, { onDelete: "cascade" })
    .notNull(),
  departmentId: integer("department_id")
    .references(() => departments.id, { onDelete: "cascade" })
    .notNull(),
});

export const taskComments = pgTable("task_comments", {
  id: serial("id").primaryKey(),
  taskId: integer("task_id")
    .references(() => tasks.id, { onDelete: "cascade" })
    .notNull(),
  userId: uuid("user_id").references(() => users.id),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const taskStatusHistory = pgTable("task_status_history", {
  id: serial("id").primaryKey(),
  taskId: integer("task_id")
    .references(() => tasks.id, { onDelete: "cascade" })
    .notNull(),
  fromStatus: taskStatusEnum("from_status"),
  toStatus: taskStatusEnum("to_status").notNull(),
  changedBy: uuid("changed_by").references(() => users.id),
  changedAt: timestamp("changed_at").defaultNow().notNull(),
});

// ---------------------------------------------------------------------------
// Relations (giúp query bằng drizzle relational API)
// ---------------------------------------------------------------------------

export const departmentsRelations = relations(departments, ({ many }) => ({
  tasks: many(tasks),
  roles: many(userRoles),
}));

export const usersRelations = relations(users, ({ many }) => ({
  roles: many(userRoles),
}));

export const userRolesRelations = relations(userRoles, ({ one }) => ({
  user: one(users, { fields: [userRoles.userId], references: [users.id] }),
  department: one(departments, {
    fields: [userRoles.departmentId],
    references: [departments.id],
  }),
}));

export const taskDepartmentsRelations = relations(taskDepartments, ({ one }) => ({
  task: one(tasks, { fields: [taskDepartments.taskId], references: [tasks.id] }),
  department: one(departments, {
    fields: [taskDepartments.departmentId],
    references: [departments.id],
  }),
}));

export const tasksRelations = relations(tasks, ({ one, many }) => ({
  department: one(departments, {
    fields: [tasks.departmentId],
    references: [departments.id],
  }),
  taskDepartments: many(taskDepartments),
  meeting: one(meetings, { fields: [tasks.meetingId], references: [meetings.id] }),
  comments: many(taskComments),
}));

export const meetingsRelations = relations(meetings, ({ many }) => ({
  tasks: many(tasks),
}));
