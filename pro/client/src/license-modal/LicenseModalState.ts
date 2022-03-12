import { localEndpoints } from "@previewjs/api";
import { LocalApi } from "@previewjs/app/client/src/api/local";
import { WebApi } from "@previewjs/app/client/src/api/web";
import { LicensePersistedState } from "@previewjs/pro-api/persisted-state";
import { makeAutoObservable, runInAction } from "mobx";
import {
  CreateLicenseTokenEndpoint,
  CreateLicenseTokenResponse,
  DeleteLicenseTokenEndpoint,
  FetchUpgradeToProConfigEndpoint,
  TokenDescription,
  UpgradeToProConfig,
} from "../networking/web-api";
import { decodeLicense } from "../state/license-encoding";

export class LicenseModalState {
  screen:
    | WelcomeScreen
    | EnterLicenseKeyScreen
    | RevokeLicenseTokenScreen
    | LicenseStateScreen = new WelcomeScreen(this);

  constructor(readonly localApi: LocalApi, readonly webApi: WebApi) {
    makeAutoObservable(this);
    const license = decodeLicense(
      this.app.preview.persistedStateController.state?.license
    );
    if (license) {
      this.switchToLicenseState(license);
    } else {
      this.switchToWelcome();
    }
  }

  switchToWelcome() {
    const screen = (this.screen = new WelcomeScreen(this));
    screen.start().catch(console.error);
    return screen;
  }

  switchToEnterKey() {
    return (this.screen = new EnterLicenseKeyScreen(this));
  }

  switchToRevokeLicenseToken(licenseKey: string, tokens: TokenDescription[]) {
    return (this.screen = new RevokeLicenseTokenScreen(
      this,
      licenseKey,
      tokens
    ));
  }

  switchToLicenseState(licenseState: LicensePersistedState) {
    return (this.screen = new LicenseStateScreen(this, licenseState));
  }
}

class WelcomeScreen {
  readonly kind = "welcome";

  loading = false;
  config: UpgradeToProConfig = {
    bodyHtml: "",
    buttons: {
      cta: "Get a license key",
      enter: "I already have a key",
    },
  };

  constructor(private readonly parent: LicenseModalState) {
    makeAutoObservable(this);
  }

  async start() {
    runInAction(() => {
      this.loading = true;
    });
    let config: UpgradeToProConfig;
    try {
      config = await this.parent.webApi.request(
        FetchUpgradeToProConfigEndpoint,
        {}
      );
    } catch (e) {
      console.error(e);
    }
    runInAction(() => {
      this.loading = false;
      this.config = config;
    });
  }
}

class EnterLicenseKeyScreen {
  readonly kind = "enter-key";

  licenseKey = "";
  loading = false;
  success = false;
  error: string | null = null;

  constructor(private readonly parent: LicenseModalState) {
    makeAutoObservable(this);
  }

  updateLicenseKey(licenseKey: string) {
    this.licenseKey = licenseKey.trim();
  }

  async submit() {
    this.loading = true;
    const maskedKey = this.licenseKey.replace(
      /^.*-(.*)$/,
      "****-****-****-****-$1"
    );
    let response: CreateLicenseTokenResponse;
    try {
      response = await this.parent.webApi.request(CreateLicenseTokenEndpoint, {
        licenseKey: this.licenseKey,
        name: this.parent.app.deviceName,
      });
    } catch (e) {
      console.error(e);
      runInAction(() => {
        this.error = "Oops! Something didn't go quite right.";
      });
      return;
    } finally {
      runInAction(() => {
        this.loading = false;
      });
    }
    switch (response.kind) {
      case "success":
        runInAction(() => {
          this.success = true;
          this.error = null;
        });
        this.parent.app.onNewLicenseToken({
          maskedKey,
          token: response.token,
        });
        setTimeout(() => {
          document.location.reload();
        }, 1000);
        break;
      case "too-many-tokens":
        this.parent.switchToRevokeLicenseToken(
          this.licenseKey,
          response.tokens
        );
        break;
      default:
        this.error = response.message;
    }
  }
}

class RevokeLicenseTokenScreen {
  readonly kind = "revoke-token";

  loading = false;
  success = false;
  error: string | null = null;

  private checked = new Set<TokenDescription>();

  constructor(
    private readonly parent: LicenseModalState,
    readonly licenseKey: string,
    readonly existingTokens: TokenDescription[]
  ) {
    makeAutoObservable(this);
  }

  toggleTokenForDeletion(token: TokenDescription, checked: boolean) {
    if (checked) {
      this.checked.add(token);
    } else {
      this.checked.delete(token);
    }
  }

  async confirm() {
    if (this.checked.size === 0) {
      this.error = "Please pick at least one.";
      return;
    }
    this.error = null;
    this.loading = true;
    try {
      for (const token of this.checked) {
        await this.parent.webApi.request(DeleteLicenseTokenEndpoint, {
          kind: "license-key",
          licenseKey: this.licenseKey,
          lastActiveTimestamp: token.lastActiveTimestamp,
          name: token.name,
        });
      }
    } catch (e) {
      console.error(e);
      runInAction(() => {
        this.error = "Oops! Something didn't go quite right.";
      });
      return;
    } finally {
      runInAction(() => {
        this.loading = false;
      });
      const screen = this.parent.switchToEnterKey();
      screen.updateLicenseKey(this.licenseKey);
      await screen.submit();
    }
  }
}

class LicenseStateScreen {
  readonly kind = "license-state";

  loading = false;
  error: string | null = null;

  constructor(
    private readonly parent: LicenseModalState,
    readonly licenseState: LicensePersistedState
  ) {
    makeAutoObservable(this);
  }

  async refresh() {
    this.loading = true;
    try {
      const wasValid = this.licenseState.checked.valid;
      const isValid = await this.parent.app.checkProLicense();
      if (!wasValid && isValid) {
        document.location.reload();
      }
    } catch (e) {
      console.error(e);
      runInAction(() => {
        this.error = "Oops! Something didn't go quite right.";
      });
      return;
    } finally {
      runInAction(() => {
        this.loading = false;
      });
    }
  }

  async unlink() {
    this.loading = true;
    try {
      await this.parent.webApi.request(DeleteLicenseTokenEndpoint, {
        kind: "license-token",
        licenseToken: this.licenseState.token,
      });
      await this.parent.localApi.request(localEndpoints.UpdateState, {
        license: null,
      });
      document.location.reload();
    } catch (e) {
      console.error(e);
      runInAction(() => {
        this.error = "Oops! Something didn't go quite right.";
      });
      return;
    } finally {
      runInAction(() => {
        this.loading = false;
      });
      const screen = this.parent.switchToWelcome();
      await screen.start();
    }
  }
}
