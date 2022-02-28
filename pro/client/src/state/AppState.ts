import { localEndpoints } from "@previewjs/api";
import { PreviewState } from "@previewjs/app/client/src/PreviewState";
import { LicensePersistedState } from "@previewjs/pro-api/persisted-state";
import { makeAutoObservable, runInAction } from "mobx";
import { ValidateLicenseTokenEndpoint } from "../networking/web-api";
import { decodeLicense, encodeLicense } from "./license-encoding";
import { ProState } from "./ProState";
import { SidePanelState } from "./SidePanelState";

const REVALIDATE_LICENSE_TOKEN_AFTER_MILLIS = 60 * 60 * 1000;

export class AppState {
  deviceName = "unknown device";
  proModalToggled = false;

  readonly preview: PreviewState;
  readonly pro: ProState;
  readonly sidePanel: SidePanelState;

  constructor() {
    makeAutoObservable(this);
    this.preview = new PreviewState({
      onFileChanged: async (filePath) => {
        await this.pro.onFileChanged(filePath);
      },
    });
    this.pro = new ProState(this.preview.localApi, this.preview.controller);
    this.sidePanel = new SidePanelState(
      this.preview.localApi,
      () => this.pro.currentFile?.filePath || null,
      (file) => {
        this.preview.setComponent(
          `${file.filePath}:${file.components[0]?.componentName}`
        );
      }
    );
  }

  async start() {
    if (!document.location.search) {
      this.sidePanel.toggle();
    }
    await this.preview.start();
    if (
      this.decodedLicense &&
      (!this.decodedLicense.checked.valid ||
        this.decodedLicense.checked.timestamp <
          Date.now() - REVALIDATE_LICENSE_TOKEN_AFTER_MILLIS)
    ) {
      await this.checkProLicense();
    }
    await this.pro.start();
  }

  async checkProLicense(): Promise<boolean> {
    const license = this.decodedLicense;
    if (!license) {
      return false;
    }
    try {
      const checkLicenseTokenResponse = await this.preview.webApi.request(
        ValidateLicenseTokenEndpoint,
        {
          licenseToken: license.token,
        }
      );
      license.checked = {
        timestamp: Date.now(),
        ...checkLicenseTokenResponse,
      };
      const state = await this.preview.localApi.request(
        localEndpoints.UpdateState,
        {
          license: encodeLicense(license),
        }
      );
      runInAction(() => {
        this.preview.persistedState = state;
      });
    } catch (e) {
      // Don't crash. User could be offline.
      console.warn(e);
    }
    return license.checked.valid;
  }

  get proEnabled() {
    return this.decodedLicense?.checked.valid === true;
  }

  get proInvalidLicenseReason() {
    if (this.decodedLicense?.checked.valid === false) {
      return this.decodedLicense.checked.reason;
    }
    return null;
  }

  async onNewLicenseToken({
    maskedKey,
    token,
  }: {
    maskedKey: string;
    token: string;
  }) {
    const state = await this.preview.localApi.request(
      localEndpoints.UpdateState,
      {
        license: encodeLicense({
          maskedKey,
          token,
          checked: {
            // We assume it's a valid one.
            timestamp: Date.now(),
            valid: true,
          },
        }),
      }
    );
    runInAction(() => {
      this.preview.persistedState = state;
    });
  }

  async stop() {
    this.pro.stop();
    this.preview.stop();
  }

  toggleProModal() {
    this.proModalToggled = !this.proModalToggled;
  }

  private get decodedLicense(): LicensePersistedState | null {
    return decodeLicense(this.preview.persistedState?.license);
  }
}
