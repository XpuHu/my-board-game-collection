import { ReceiptText } from "lucide-react";
import { EmptyState } from "@/components/empty-state";

export default function PurchasesPage() {
  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <EmptyState
        icon={ReceiptText}
        title="Покупки"
        description="История покупок появится после подключения Purchase API."
      />
    </main>
  );
}
