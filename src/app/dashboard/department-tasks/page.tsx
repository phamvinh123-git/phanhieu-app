import { KanbanBoard } from "@/components/KanbanBoard";

export default function DepartmentTasksPage() {
  return (
    <KanbanBoard
      level="department"
      title="Kanban cấp Phòng"
      description="Trưởng phòng tự chia nhỏ nhiệm vụ được Phân Hiệu giao và tự quản lý tiến độ tại đây."
    />
  );
}
