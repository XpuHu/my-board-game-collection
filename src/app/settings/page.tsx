import { requireFullProduct } from "@/server/config/product-mode";
import { SettingsPageClient } from "./settings-page-client";
import { getIntegrationFeatureFlags } from "@/server/config/feature-flags";

export default function SettingsPage() {
  requireFullProduct();
  return <SettingsPageClient featureFlags={getIntegrationFeatureFlags()} />;
}
