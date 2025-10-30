# Penny Platform Configuration Package

Centralized configuration management for the Penny Platform monorepo.

## Structure

- `ts/` - TypeScript/Node.js configuration (Zod schema + loader)
- `py/` - Python configuration (Pydantic settings)

## Usage

### TypeScript/Node.js

```typescript
import { ENV } from "@penny/config";

console.log(ENV.SEARCH_API_URL);
```

### Python

```python
from packages.config.py.settings import SETTINGS

print(SETTINGS.SEARCH_API_URL)
```

## Environment Loading

Configuration is loaded from layered `.env` files in `/env`:

1. `.env` (global fallbacks)
2. `.env.<PROFILE>` (e.g., `.env.dev`, `.env.test`)
3. `.env.local` (per-dev machine overrides)
4. `.env.<PROFILE>.local` (per-profile local overrides)

The active profile is determined by the `PROFILE` environment variable (default: `dev`).

