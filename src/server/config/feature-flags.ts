export type IntegrationFeatureFlags = {
  externalProvidersEnabled: boolean;
  bggSyncEnabled: boolean;
  bggApplicationTokenConfigured: boolean;
};

export function getIntegrationFeatureFlags(): IntegrationFeatureFlags {
  return {
    externalProvidersEnabled: isEnabled(process.env.EXTERNAL_PROVIDERS_ENABLED),
    bggSyncEnabled: isEnabled(process.env.BGG_SYNC_ENABLED),
    bggApplicationTokenConfigured: Boolean(
      process.env.BGG_APPLICATION_TOKEN?.trim(),
    ),
  };
}

function isEnabled(value: string | undefined) {
  return value === "true";
}
