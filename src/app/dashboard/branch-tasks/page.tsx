import { Suspense } from "react";
import { ContentLoader } from "@/components/SplashScreen";
import { KanbanBoard } from "@/components/KanbanBoard";

export default function BranchTasksPage() {
  return (
    <Suspense fallback={<ContentLoader />}>
      <KanbanBoard
        level="branch"
        title="Nhiệm vụ cấp Phân Hiệu"
      />
    </Suspense>
  );
}
