// NOTE: Be careful when updating this. Backward compatibility is important!

export interface LicensePersistedState {
  maskedKey: string;
  token: string;
  checked:
    | {
        timestamp: number;
        valid: true;
      }
    | {
        timestamp: number;
        valid: false;
        reason: string;
      };
}
