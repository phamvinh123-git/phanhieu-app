import { KanbanBoard } from "@/components/KanbanBoard";

export default function BranchTasksPage() {
  return (
    <KanbanBoard
      level="branch"
      title="Nhiệm vụ cấp Phân hiệu"
      description="Công việc do Thư kí phân hiệu phân bổ cho các Phòng sau mỗi cuộc họp chủ chốt."
    />
  );
}
