import { getProductFeatures } from "@/server/config/product-mode";
import { redirect } from "next/navigation";
import HomePage from "./dashboard-page-client";
export default function Page() {
  if (getProductFeatures().mode === "mvp") redirect("/collection");
  return <HomePage />;
}
