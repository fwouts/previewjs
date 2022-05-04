import { WebApi } from "@previewjs/app/client/src/api/web";
import { LicenseInfo } from "@previewjs/pro-api/persisted-state";
import { makeAutoObservable, runInAction } from "mobx";
import {
  CreateLicenseTokenResponse,
  TokenDescription,
} from "../networking/web-api";
import { LicenseState } from "../state/LicenseState";

export class LicenseModalState {
  screen:
    | null
    | EnterLicenseKeyScreen
    | RevokeLicenseTokenScreen
    | LicenseStateScreen = null;

  constructor(readonly webApi: WebApi, readonly license: LicenseState) {
    makeAutoObservable(this);
  }

  toggle() {
    if (this.screen === null) {
      if (this.license.decodedLicense) {
        return this.switchToLicenseState(this.license.decodedLicense);
      } else {
        return this.switchToEnterKey();
      }
    } else {
      return (this.screen = null);
    }
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

  switchToLicenseState(licenseState: LicenseInfo) {
    return (this.screen = new LicenseStateScreen(this, licenseState));
  }
}

export class EnterLicenseKeyScreen {
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

  back() {
    this.parent.toggle();
  }

  async submit() {
    this.loading = true;
    const maskedKey = this.licenseKey.replace(
      /^.*-(.*)$/,
      "****-****-****-****-$1"
    );
    let response: CreateLicenseTokenResponse;
    try {
      response = await this.parent.license.createLicenseToken(this.licenseKey);
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
        this.parent.license.onNewLicenseToken({
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

export class RevokeLicenseTokenScreen {
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

  back() {
    this.parent.switchToEnterKey();
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
        await this.parent.license.revokeToken(this.licenseKey, token.id);
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

export class LicenseStateScreen {
  readonly kind = "license-state";

  loading = false;
  error: string | null = null;

  constructor(
    private readonly parent: LicenseModalState,
    readonly licenseInfo: LicenseInfo
  ) {
    makeAutoObservable(this);
  }

  async refresh() {
    this.loading = true;
    try {
      const wasValid = this.licenseInfo.checked.valid;
      const isValid = await this.parent.license.checkProLicense();
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

  close() {
    this.parent.toggle();
  }

  async unlink() {
    this.loading = true;
    try {
      await this.parent.license.unlink();
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
      this.parent.switchToEnterKey();
    }
  }
}
