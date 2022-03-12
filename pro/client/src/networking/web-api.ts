import type { Endpoint } from "@previewjs/api";

export const FetchUpgradeToProConfigEndpoint: Endpoint<{}, UpgradeToProConfig> =
  {
    path: "config/upgrade-to-pro",
  };

export const CreateLicenseTokenEndpoint: Endpoint<
  CreateLicenseTokenRequest,
  CreateLicenseTokenResponse
> = {
  path: "licenses/tokens/create",
};

export const DeleteLicenseTokenEndpoint: Endpoint<
  DeleteLicenseTokenRequest,
  DeleteLicenseTokenResponse
> = {
  path: "licenses/tokens/delete",
};

export const ValidateLicenseTokenEndpoint: Endpoint<
  ValidateLicenseTokenRequest,
  ValidateLicenseTokenResponse
> = {
  path: "licenses/tokens/validate",
};

export interface UpgradeToProConfig {
  bodyHtml: string;
  buttons: {
    cta: string;
    enter: string;
  };
}

export interface CreateLicenseTokenRequest {
  licenseKey: string;
  id: string;
}

export type CreateLicenseTokenResponse =
  | {
      kind: "success";
      token: string;
    }
  | {
      kind: "invalid-license-key";
      message: string;
    }
  | {
      kind: "too-many-tokens";
      message: string;
      tokens: TokenDescription[];
    };

export interface TokenDescription {
  id: string;
  lastActiveTimestamp: number;
}

export type DeleteLicenseTokenRequest =
  | {
      kind: "license-key";
      licenseKey: string;
      id: string;
    }
  | {
      kind: "license-token";
      licenseToken: string;
    };

export interface DeleteLicenseTokenResponse {}

export type ValidateLicenseTokenRequest = {
  licenseToken: string;
};

export type ValidateLicenseTokenResponse =
  | {
      valid: true;
    }
  | {
      valid: false;
      reason: string;
    };
