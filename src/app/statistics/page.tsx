import { ChartNoAxesColumn } from "lucide-react";
import { EmptyState } from "@/components/empty-state";

export default function StatisticsPage() {
  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <EmptyState
        icon={ChartNoAxesColumn}
        title="Статистика"
        description="Главный фокус раздела - история партий, топ игр, активные месяцы и сводные показатели коллекции."
      />
    </main>
  );
}
