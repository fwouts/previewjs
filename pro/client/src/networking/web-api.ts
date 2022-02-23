import { declareEndpoint } from "@previewjs/core/api";

export const FetchUpgradeToProConfigEndpoint = declareEndpoint<
  {},
  UpgradeToProConfig
>("config/upgrade-to-pro");

export const CreateLicenseTokenEndpoint = declareEndpoint<
  CreateLicenseTokenRequest,
  CreateLicenseTokenResponse
>("licenses/tokens/create");

export const DeleteLicenseTokenEndpoint = declareEndpoint<
  DeleteLicenseTokenRequest,
  DeleteLicenseTokenResponse
>("licenses/tokens/delete");

export const ValidateLicenseTokenEndpoint = declareEndpoint<
  ValidateLicenseTokenRequest,
  ValidateLicenseTokenResponse
>("licenses/tokens/validate");

export interface UpgradeToProConfig {
  bodyHtml: string;
  buttons: {
    cta: string;
    enter: string;
  };
}

export interface CreateLicenseTokenRequest {
  licenseKey: string;
  name: string;
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
  name: string;
  lastActiveTimestamp: number;
}

export type DeleteLicenseTokenRequest =
  | {
      kind: "license-key";
      licenseKey: string;
      name: string;
      lastActiveTimestamp: number;
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
