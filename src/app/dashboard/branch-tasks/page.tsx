import { KanbanBoard } from "@/components/KanbanBoard";

export default function BranchTasksPage() {
  return (
    <KanbanBoard
      level="branch"
      title="Nhiệm vụ cấp Phân Hiệu"
      description="Công việc do Thư ký Phân Hiệu phân bổ cho các Phòng sau mỗi cuộc họp chủ chốt."
    />
  );
}
