#!/usr/bin/env node
/**
 * Load environment variables from central env files for Node.js applications
 * Usage: node scripts/load-env.js [profile]
 */

const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
const ENV_DIR = path.join(ROOT_DIR, 'env');
const PROFILE = process.argv[2] || process.env.PROFILE || 'dev';

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

// Load base .env
const baseEnv = loadEnvFile(path.join(ENV_DIR, '.env'));

// Load profile-specific .env (overrides base)
const profileEnv = loadEnvFile(path.join(ENV_DIR, `.env.${PROFILE}`));

// Merge environments (profile overrides base)
const mergedEnv = { ...baseEnv, ...profileEnv };

// Set PROFILE
mergedEnv.PROFILE = PROFILE;

// Set Firebase emulator hosts for dev/test
if (PROFILE === 'dev' || PROFILE === 'test') {
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
  console.log(`Loaded environment for profile: ${PROFILE}`);
  console.log(`Environment variables: ${Object.keys(mergedEnv).length} keys`);
}

module.exports = mergedEnv;

