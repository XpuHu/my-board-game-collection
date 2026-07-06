import { Settings } from "lucide-react";
import { EmptyState } from "@/components/empty-state";

export default function SettingsPage() {
  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <EmptyState
        icon={Settings}
        title="Настройки"
        description="Здесь появятся настройки темы, Provider, импорта и экспорта."
      />
    </main>
  );
}
