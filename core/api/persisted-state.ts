// NOTE: Be careful when updating this. Backward compatibility is important!

export interface PersistedState {
  updateDismissed?: {
    timestamp: number;
  };
  license?: string | null;
}
