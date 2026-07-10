import { SettingsPageClient } from "./settings-page-client";
import { getIntegrationFeatureFlags } from "@/server/config/feature-flags";

export default function SettingsPage() {
  return <SettingsPageClient featureFlags={getIntegrationFeatureFlags()} />;
}
