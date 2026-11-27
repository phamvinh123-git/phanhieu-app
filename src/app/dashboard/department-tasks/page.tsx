import { Suspense } from "react";
import { redirect } from "next/navigation";
import { ContentLoader } from "@/components/SplashScreen";
import { KanbanBoard } from "@/components/KanbanBoard";
import { DEPARTMENT_KANBAN_ENABLED } from "@/lib/rbac-config";

export default function DepartmentTasksPage() {
  // Kanban cấp Phòng chưa triển khai → chuyển về Nhiệm vụ Phân hiệu giao.
  if (!DEPARTMENT_KANBAN_ENABLED) redirect("/dashboard/branch-tasks");
  return (
    <Suspense fallback={<ContentLoader />}>
      <KanbanBoard level="department" title="Kanban cấp Phòng" />
    </Suspense>
  );
}
