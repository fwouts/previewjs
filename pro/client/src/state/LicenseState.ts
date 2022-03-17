import { WebApi } from "@previewjs/app/client/src/api/web";
import { PersistedStateController } from "@previewjs/app/client/src/PersistedStateController";
import { LicenseInfo } from "@previewjs/pro-api/persisted-state";
import { makeAutoObservable } from "mobx";
import * as uuid from "uuid";
import {
  CreateLicenseTokenEndpoint,
  DeleteLicenseTokenEndpoint,
  ValidateLicenseTokenEndpoint,
} from "../networking/web-api";
import { decodeLicense, encodeLicense } from "./license-encoding";

const REVALIDATE_LICENSE_TOKEN_AFTER_MILLIS = 60 * 60 * 1000;

export class LicenseState {
  constructor(
    private readonly webApi: WebApi,
    private readonly persistedStateController: PersistedStateController
  ) {
    makeAutoObservable(this);
  }

  async start() {
    if (
      this.decodedLicense &&
      (!this.decodedLicense.checked.valid ||
        this.decodedLicense.checked.timestamp <
          Date.now() - REVALIDATE_LICENSE_TOKEN_AFTER_MILLIS)
    ) {
      await this.checkProLicense();
    }
  }

  async checkProLicense(): Promise<boolean> {
    const license = this.decodedLicense;
    if (!license) {
      return false;
    }
    try {
      const checkLicenseTokenResponse = await this.webApi.request(
        ValidateLicenseTokenEndpoint,
        {
          licenseToken: license.token,
        }
      );
      license.checked = {
        timestamp: Date.now(),
        ...checkLicenseTokenResponse,
      };
      await this.persistedStateController.update({
        license: encodeLicense(license),
      });
    } catch (e) {
      // Don't crash. User could be offline.
      console.warn(e);
    }
    return license.checked.valid;
  }

  get proStatus() {
    switch (this.decodedLicense?.checked.valid) {
      case true:
        return "enabled";
      case false:
        return "disabled";
      default:
        return "loading";
    }
  }

  get proInvalidLicenseReason() {
    if (this.decodedLicense?.checked.valid === false) {
      return this.decodedLicense.checked.reason;
    }
    return null;
  }

  async createLicenseToken(licenseKey: string) {
    return await this.webApi.request(CreateLicenseTokenEndpoint, {
      licenseKey,
      id: uuid.v4(),
    });
  }

  async onNewLicenseToken({
    maskedKey,
    token,
  }: {
    maskedKey: string;
    token: string;
  }) {
    await this.persistedStateController.update({
      license: encodeLicense({
        maskedKey,
        token,
        checked: {
          // We assume it's a valid one.
          timestamp: Date.now(),
          valid: true,
        },
      }),
    });
  }

  async unlink() {
    const licenseToken = this.decodedLicense?.token;
    if (!licenseToken) {
      // Nothing to do.
      return;
    }
    await this.webApi.request(DeleteLicenseTokenEndpoint, {
      kind: "license-token",
      licenseToken,
    });
    await this.persistedStateController.update({
      license: null,
    });
  }

  async revokeToken(licenseKey: string, id: string) {
    await this.webApi.request(DeleteLicenseTokenEndpoint, {
      kind: "license-key",
      licenseKey,
      id,
    });
  }

  get decodedLicense(): LicenseInfo | null {
    return decodeLicense(this.persistedStateController.state?.license);
  }
}
