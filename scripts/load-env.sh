#!/bin/bash
# Load environment variables from central env files
# Usage: source scripts/load-env.sh [profile]
# Profile defaults to 'dev' if not specified

set -euo pipefail

# Only set ROOT_DIR if not already set (e.g., when sourced from startup.sh)
# Use BASH_SOURCE[0] to get the actual script location, not $0 which can be unreliable
if [[ -z "${ROOT_DIR:-}" ]]; then
    ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
fi
ENV_DIR="${ROOT_DIR}/env"
PROFILE="${1:-${PROFILE:-dev}}"

# Export PROFILE so it's available
export PROFILE="${PROFILE}"

# Function to load env file
load_env_file() {
    local file="$1"
    if [[ -f "$file" ]]; then
        # Read file line by line, ignoring comments and empty lines
        while IFS= read -r line || [[ -n "$line" ]]; do
            # Skip comments and empty lines
            [[ "$line" =~ ^[[:space:]]*# ]] && continue
            [[ -z "${line// }" ]] && continue
            
            # Export variable (handle values with spaces and special chars)
            if [[ "$line" =~ ^[[:space:]]*([^=]+)=(.*)$ ]]; then
                local key="${BASH_REMATCH[1]}"
                local value="${BASH_REMATCH[2]}"
                # Remove leading/trailing whitespace from key
                key="${key%"${key##*[![:space:]]}"}"
                key="${key#"${key%%[![:space:]]*}"}"
                # Remove quotes from value if present
                value="${value#\"}"
                value="${value%\"}"
                value="${value#\'}"
                value="${value%\'}"
                export "${key}=${value}"
            fi
        done < "$file"
    fi
}

# Load base .env file first
if [[ -f "${ENV_DIR}/.env" ]]; then
    load_env_file "${ENV_DIR}/.env"
fi

# Load profile-specific .env file (overrides base)
if [[ -f "${ENV_DIR}/.env.${PROFILE}" ]]; then
    load_env_file "${ENV_DIR}/.env.${PROFILE}"
fi

# Ensure Firebase emulator hosts are set for local development
if [[ "${PROFILE}" == "dev" ]] || [[ "${PROFILE}" == "test" ]]; then
    export FIRESTORE_EMULATOR_HOST="${FIRESTORE_EMULATOR_HOST:-127.0.0.1:9002}"
    export FIREBASE_AUTH_EMULATOR_HOST="${FIREBASE_AUTH_EMULATOR_HOST:-127.0.0.1:9001}"
    export STORAGE_EMULATOR_HOST="${STORAGE_EMULATOR_HOST:-http://127.0.0.1:9003}"
    export PUBSUB_EMULATOR_HOST="${PUBSUB_EMULATOR_HOST:-127.0.0.1:9005}"
    export GOOGLE_CLOUD_PROJECT="${GOOGLE_CLOUD_PROJECT:-demo-penny-dev}"
fi

