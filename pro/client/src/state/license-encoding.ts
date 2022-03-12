import { LicenseInfo } from "@previewjs/pro-api/persisted-state";
import { decode, encode } from "universal-base64";

export function decodeLicense(encoded?: string | null): LicenseInfo | null {
  if (encoded) {
    try {
      const license = JSON.parse(decode(encoded));
      return license;
    } catch (e) {
      console.warn(e);
    }
  }
  return null;
}

export function encodeLicense(license: LicenseInfo): string {
  return encode(JSON.stringify(license));
}
