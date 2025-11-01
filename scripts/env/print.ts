#!/usr/bin/env node
/**
 * Print resolved environment configuration (excluding secrets).
 * Usage: PROFILE=dev node scripts/env/print.ts
 */

import { ENV } from "../../packages/config/ts/index.js";

const secrets = [
  "OPENAI_API_KEY",
  "DEEPINFRA_API_KEY",
  "BRIGHTDATA_API_KEY",
  "BRIGHTDATA_API_TOKEN",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "GMAIL_CLIENT_SECRET",
];

function maskSecret(value: string | undefined): string {
  if (!value) return "(not set)";
  if (value.length <= 8) return "***";
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

console.log("📋 Resolved Environment Configuration\n");
console.log(`Profile: ${ENV.PROFILE}`);
console.log(`App Env: ${ENV.APP_ENV}`);
console.log(`Log Level: ${ENV.LOG_LEVEL}\n`);

console.log("Configuration Values:\n");
const sortedKeys = Object.keys(ENV).sort();
for (const key of sortedKeys) {
  const value = ENV[key as keyof typeof ENV];
  const isSecret = secrets.some((s) => key.includes(s));
  const displayValue = isSecret ? maskSecret(String(value)) : value;
  console.log(`  ${key}: ${displayValue}`);
}

