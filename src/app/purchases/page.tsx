import { requireFullProduct } from "@/server/config/product-mode";
import { PurchasesPageClient } from "./purchases-page-client";

export default function PurchasesPage() {
  requireFullProduct();
  return <PurchasesPageClient />;
}
