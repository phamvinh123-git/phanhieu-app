import { Suspense } from "react";
import { ContentLoader } from "@/components/SplashScreen";
import { KanbanBoard } from "@/components/KanbanBoard";

export default function DepartmentTasksPage() {
  return (
    <Suspense fallback={<ContentLoader />}>
      <KanbanBoard
        level="department"
        title="Kanban cấp Phòng"
      />
    </Suspense>
  );
}
