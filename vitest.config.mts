import { fileURLToPath } from "node:url";
import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";

const fileEnv = loadEnv("test", process.cwd(), "");
const testDatabaseUrl = process.env.TEST_DATABASE_URL ?? fileEnv.TEST_DATABASE_URL ?? "";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // The real package throws outside React Server Components.
      "server-only": fileURLToPath(new URL("./src/test/empty.ts", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    globalSetup: ["./src/test/global-setup.ts"],
    setupFiles: ["./src/test/setup.ts"],
    // Integration tests share one database, so files run one after another.
    fileParallelism: false,
    env: {
      // Tests never touch the app database: DATABASE_URL points at the test DB.
      DATABASE_URL: testDatabaseUrl,
      TEST_DATABASE_URL: testDatabaseUrl,
      APP_URL: "http://localhost:3200",
      // Throw-away key for tests only.
      TOTP_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString("base64"),
      SMTP_HOST: "localhost",
      SMTP_PORT: "1025",
      MAIL_FROM: "test@b2b.example",
      TURNSTILE_SITE_KEY: "test-site-key",
      TURNSTILE_SECRET_KEY: "test-secret-key",
      TRUSTED_PROXY_COUNT: "1",
    },
  },
});
