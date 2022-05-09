// NOTE: Be careful when updating this. Backward compatibility is important!

export interface LicenseInfo {
  maskedKey: string;
  token: string;
  checked:
    | {
        timestamp: number;
        valid: true;
        trial?: {
          remainingDays: number;
        } | null;
      }
    | {
        timestamp: number;
        valid: false;
        reason: string;
        wasTrial?: boolean;
      };
}
