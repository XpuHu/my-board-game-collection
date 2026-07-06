import { Package } from "lucide-react";
import { EmptyState } from "@/components/empty-state";

export default function PreordersPage() {
  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <EmptyState
        icon={Package}
        title="Предзаказы"
        description="Здесь будут активные предзаказы, ожидаемые даты и быстрое изменение даты доставки."
      />
    </main>
  );
}
