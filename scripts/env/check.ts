#!/usr/bin/env node
/**
 * Check that all required environment variables are present.
 * Usage: PROFILE=dev node scripts/env/check.ts
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ENV } from "../../packages/config/ts/index.js";

const repoRoot = join(import.meta.dirname, "../..");
const stageFiles = [
  ".env.development",
  ".env.production",
];

const exampleKeys: Set<string> = new Set();

for (const filename of stageFiles) {
  try {
    const exampleContent = readFileSync(join(repoRoot, "env", filename), "utf-8");
    exampleContent
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#") && line.includes("="))
      .forEach((line) => {
        const key = line.split("=")[0]?.trim();
        if (key) {
          exampleKeys.add(key);
        }
      });
  } catch (error) {
    console.warn(`⚠️  Skipping missing env file: ${filename}`);
  }
}

const resolvedKeys = new Set(Object.keys(ENV));
const missing = Array.from(exampleKeys).filter((key) => !resolvedKeys.has(key));

if (missing.length > 0) {
  console.error(`❌ Missing environment variables from resolved config:`);
  missing.forEach((key) => console.error(`   - ${key}`));
  console.error("\n💡 Tip: Ensure env/.env.development and env/.env.production define the required keys.");
  process.exit(1);
}

console.log("✅ Environment variables loaded successfully for all stages");
process.exit(0);
