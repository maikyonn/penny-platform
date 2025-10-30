import path from "node:path";
import { config as load } from "dotenv-flow";
import { EnvSchema, type Env } from "./env.schema";

const PROFILE = process.env.PROFILE || "dev";

// Load .env layering from /env + local overrides in package dirs
load({
  node_env: PROFILE, // maps to .env.<PROFILE>
  path: path.resolve(process.cwd(), "../../env"), // from package => repo/env
  silent: true,
});

// Also load package-local .env[.<PROFILE>][.local]
load({ node_env: PROFILE, silent: true });

const parsed = EnvSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("❌ Invalid environment variables:", parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const ENV: Env = parsed.data;

