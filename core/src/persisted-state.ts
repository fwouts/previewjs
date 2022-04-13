import { localEndpoints, PersistedState } from "@previewjs/api";
import envPaths from "env-paths";
import fs from "fs-extra";
import path from "path";
import { RequestHandlerForEndpoint } from "./router";

export interface PersistedStateManager {
  get: RequestHandlerForEndpoint<typeof localEndpoints.GetState>;
  update: RequestHandlerForEndpoint<typeof localEndpoints.UpdateState>;
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

  update = async (partialState: Partial<PersistedState>) => {
    return this.#update(partialState);
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
