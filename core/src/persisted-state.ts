import type { PersistedState } from "@previewjs/api";
import envPaths from "env-paths";
import type express from "express";
import fs from "fs-extra";
import path from "path";

export interface PersistedStateManager {
  get(req: express.Request): Promise<PersistedState>;
  update(req: express.Request, res: express.Response): Promise<PersistedState>;
}

export class LocalFilePersistedStateManager implements PersistedStateManager {
  constructor(
    private readonly absoluteFilePath: string = path.join(
      envPaths("previewjs").config,
      "state.json"
    )
  ) {}

  get = async () => {
    const state = await this.#read();
    return state || this.#update({});
  };

  update = async (req: express.Request) => {
    return this.#update(req.body);
  };

  async #read(): Promise<PersistedState | null> {
    try {
      const content = await fs.readFile(this.absoluteFilePath, "utf8");
      return JSON.parse(content);
    } catch {
      return null;
    }
  }

  async #update(
    partialState: Partial<PersistedState>
  ): Promise<PersistedState> {
    const state = {
      ...(await (this.#read() || {})),
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
