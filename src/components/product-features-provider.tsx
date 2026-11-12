"use client";
import { createContext, useContext, type ReactNode } from "react";
import {
  mvpFeatures,
  type ProductFeatures,
} from "@/shared/config/product-features";
const ProductContext = createContext<ProductFeatures>(mvpFeatures);
export function ProductFeaturesProvider({
  features,
  children,
}: {
  features: ProductFeatures;
  children: ReactNode;
}) {
  return (
    <ProductContext.Provider value={features}>
      {children}
    </ProductContext.Provider>
  );
}
export function useProductFeatures() {
  return useContext(ProductContext);
}
