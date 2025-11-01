#!/usr/bin/env node
/**
 * Load environment variables from central env files for Node.js applications
 * Usage: node scripts/load-env.js [profile]
 */

const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
const ENV_DIR = path.join(ROOT_DIR, 'env');
const PROFILE_INPUT = (process.argv[2] || process.env.APP_ENV || process.env.PROFILE || 'development').toLowerCase();

const STAGE_ALIASES = {
  dev: "development",
  development: "development",
  local: "development",
  test: "development",
  ci: "development",
  prod: "production",
  production: "production",
};

const STAGE = STAGE_ALIASES[PROFILE_INPUT] || "development";

// Function to parse env file
function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return {};
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  const env = {};

  content.split('\n').forEach((line) => {
    // Skip comments and empty lines
    line = line.trim();
    if (!line || line.startsWith('#')) {
      return;
    }

    // Parse KEY=VALUE
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
      let key = match[1].trim();
      let value = match[2].trim();

      // Remove quotes if present
      if ((value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }

      env[key] = value;
    }
  });

  return env;
}

const stageEnvCandidates = [
  path.join(ENV_DIR, `.env.${STAGE}`),
  path.join(ENV_DIR, `.env.${STAGE}.local`),
];

let stageEnv = {};
let loadedPath = null;

for (const candidate of stageEnvCandidates) {
  const candidateEnv = loadEnvFile(candidate);
  if (Object.keys(candidateEnv).length) {
    stageEnv = candidateEnv;
    loadedPath = candidate;
    break;
  }
}

if (!loadedPath) {
  const examplePath = path.join(ENV_DIR, `.env.${STAGE}.example`);
  if (fs.existsSync(examplePath)) {
    console.warn(`ℹ️  No environment file found for stage "${STAGE}". Copy ${path.relative(ROOT_DIR, examplePath)} to env/.env.${STAGE} and populate secrets.`);
  } else {
    console.warn(`⚠️  No environment file found for stage "${STAGE}" in ${ENV_DIR}`);
  }
}

const mergedEnv = {
  ...stageEnv,
};

mergedEnv.PROFILE = STAGE === "production" ? "prod" : "dev";
mergedEnv.APP_ENV = STAGE;
mergedEnv.NODE_ENV = STAGE === "production" ? "production" : "development";

// Set Firebase emulator hosts for dev/test
if (STAGE !== 'production') {
  mergedEnv.FIRESTORE_EMULATOR_HOST = mergedEnv.FIRESTORE_EMULATOR_HOST || 'localhost:9002';
  mergedEnv.FIREBASE_AUTH_EMULATOR_HOST = mergedEnv.FIREBASE_AUTH_EMULATOR_HOST || 'localhost:9001';
  mergedEnv.STORAGE_EMULATOR_HOST = mergedEnv.STORAGE_EMULATOR_HOST || 'localhost:9003';
  mergedEnv.PUBSUB_EMULATOR_HOST = mergedEnv.PUBSUB_EMULATOR_HOST || 'localhost:9005';
  mergedEnv.GOOGLE_CLOUD_PROJECT = mergedEnv.GOOGLE_CLOUD_PROJECT || 'penny-dev';
}

// Export to process.env
Object.keys(mergedEnv).forEach((key) => {
  process.env[key] = mergedEnv[key];
});

// If run directly, print env vars (for debugging)
if (require.main === module) {
  console.log(`Loaded environment for profile: ${STAGE}`);
  console.log(`Environment variables: ${Object.keys(mergedEnv).length} keys`);
}

module.exports = mergedEnv;
