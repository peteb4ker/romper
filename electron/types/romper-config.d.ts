import type { RomperEnv } from "../../shared/electronApi.js";

declare global {
  interface Window {
    romperEnv?: RomperEnv;
  }
}
