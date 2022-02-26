import envPaths from "env-paths";
import fs from "fs-extra";
import path from "path";
import { PersistedState } from "./api";

export class PersistedStateManager {
  constructor(
    private readonly absoluteFilePath: string = path.join(
      envPaths("previewjs").config,
      "state.json"
    )
  ) {}

  async get(): Promise<PersistedState> {
    const state = await this.read();
    return state || this.update({});
  }

  private async read(): Promise<PersistedState | null> {
    try {
      const content = await fs.readFile(this.absoluteFilePath, "utf8");
      return JSON.parse(content);
    } catch {
      return null;
    }
  }

  async update(partialState: Partial<PersistedState>): Promise<PersistedState> {
    const state = {
      ...(await (this.read() || {})),
      ...partialState,
    };
    await fs.ensureDir(path.dirname(this.absoluteFilePath));
    await fs.writeFile(
      this.absoluteFilePath,
      JSON.stringify(state, null, 2),
      "utf8"
    );
    return state;
  }
}
