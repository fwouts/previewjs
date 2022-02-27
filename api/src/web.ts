import { Endpoint } from "./endpoint";

export const CheckVersion: Endpoint<CheckVersionRequest, CheckVersionResponse> =
  {
    path: "versions/check",
  };

export type CheckVersionRequest = {
  appInfo: VersionInfo;
};

export interface VersionInfo {
  platform: string;
  version: string;
}

export interface CheckVersionResponse {
  update: UpdateAvailability;
}

export type UpdateAvailability =
  | {
      available: false;
      url?: string;
    }
  | UpdateAvailable;

export interface UpdateAvailable {
  available: true;
  required: boolean;
  bannerMessage: string;
  url: string;
}
