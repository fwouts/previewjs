import { LicensePersistedState } from "@previewjs/pro-api/persisted-state";

export function decodeLicense(
  encoded?: string | null
): LicensePersistedState | null {
  if (encoded) {
    try {
      const license = JSON.parse(atob(encoded));
      return license;
    } catch (e) {
      console.warn(e);
    }
  }
  return null;
}

export function encodeLicense(license: LicensePersistedState): string {
  return btoa(JSON.stringify(license));
}
