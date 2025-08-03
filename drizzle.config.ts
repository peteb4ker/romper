import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "sqlite",
  out: "./electron/main/db/migrations",
  schema: "./shared/db/schema.ts",
});
