import { Clock } from "lucide-react";
import { EmptyState } from "@/components/empty-state";

export default function PreordersPage() {
  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <EmptyState
        icon={Clock}
        title="Предзаказы"
        description="Список предзаказов будет подключен после реализации Preorder API."
      />
    </main>
  );
}
