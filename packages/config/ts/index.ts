import fs from "node:fs";
import path from "node:path";
import { config as load } from "dotenv";
import { EnvSchema, type Env } from "./env.schema";

const PROFILE_INPUT =
  (process.env.APP_ENV ||
    process.env.PROFILE ||
    process.env.NODE_ENV ||
    "development").toLowerCase();

const STAGE_ALIASES: Record<string, "development" | "production"> = {
  dev: "development",
  development: "development",
  local: "development",
  test: "development",
  ci: "development",
  prod: "production",
  production: "production",
};

const STAGE = STAGE_ALIASES[PROFILE_INPUT] ?? "development";

process.env.PROFILE = STAGE === "production" ? "prod" : "dev";
process.env.APP_ENV = STAGE;
process.env.NODE_ENV = STAGE === "production" ? "production" : "development";

const envDir = path.resolve(process.cwd(), "../../env");
const stageEnvCandidates = [
  path.join(envDir, `.env.${STAGE}`),
  path.join(envDir, `.env.${STAGE}.local`),
];

let loadedFrom: string | null = null;
for (const candidate of stageEnvCandidates) {
  if (fs.existsSync(candidate)) {
    load({ path: candidate, override: true });
    loadedFrom = candidate;
    break;
  }
}

if (!loadedFrom) {
  const examplePath = path.join(envDir, `.env.${STAGE}.example`);
  if (fs.existsSync(examplePath)) {
    console.warn(`ℹ️  No .env file found for stage "${STAGE}". Copy ${examplePath} to env/.env.${STAGE} and populate secrets.`);
  } else {
    console.warn(`⚠️  Environment file not found for stage "${STAGE}" in ${envDir}`);
  }
}

const parsed = EnvSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("❌ Invalid environment variables:", parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const ENV: Env = parsed.data;
