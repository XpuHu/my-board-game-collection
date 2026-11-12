import { redirect } from "next/navigation";
import { featuresForMode } from "@/shared/config/product-features";
export function getProductFeatures() {
  return featuresForMode(
    process.env.APP_PRODUCT_MODE === "full" ? "full" : "mvp",
  );
}
export function requireFullProduct() {
  if (getProductFeatures().mode === "mvp") redirect("/collection");
}
