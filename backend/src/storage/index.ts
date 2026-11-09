import { IStorageAdapter } from "./storageAdapter.interface.js";
import { LocalStorageAdapter } from "./localStorageAdapter.js";
import { env } from "../config/env.js";

function createStorageAdapter(): IStorageAdapter {
  switch (env.STORAGE_DRIVER) {
    case "local":
    default:
      return new LocalStorageAdapter();
  }
}

export const storageAdapter = createStorageAdapter();
export * from "./storageAdapter.interface.js";

