export type ProductMode = "mvp" | "full";
export type ProductFeatures = {
  mode: ProductMode;
  plays: boolean;
  statistics: boolean;
  wishlist: boolean;
  standaloneTools: boolean;
};
export function featuresForMode(mode: ProductMode): ProductFeatures {
  const full = mode === "full";
  return {
    mode,
    plays: full,
    statistics: full,
    wishlist: full,
    standaloneTools: full,
  };
}
export const mvpFeatures = featuresForMode("mvp");
