import { LicenseInfo } from "@previewjs/pro-api/persisted-state";

export function decodeLicense(encoded?: string | null): LicenseInfo | null {
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

export function encodeLicense(license: LicenseInfo): string {
  return btoa(JSON.stringify(license));
}
