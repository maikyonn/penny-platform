# Migration Guide: Monorepo Restructure

This document outlines the changes made during the monorepo restructure and how to migrate existing code.

## Directory Changes

### Before
```
/
├── DIME-AI-SEARCH-API/
├── penny-bd/
├── DIME-AI-VIEWER/
└── ...
```

### After
```
/
├── services/
│   ├── search/          # was DIME-AI-SEARCH-API
│   ├── brightdata/      # was penny-bd
│   └── viewer/          # was DIME-AI-VIEWER
├── packages/
│   └── config/          # NEW: centralized config
├── env/                 # NEW: centralized env files
└── scripts/
    └── env/             # NEW: env helper scripts
```

## Configuration Changes

### Old Way (Per-Service)
Each service had its own `app/config.py`:
```python
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env")
    PORT: int = 7001
    # ... service-specific settings
```

### New Way (Centralized)
All services use the shared config package:
```python
import sys
from pathlib import Path

_repo_root = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(_repo_root))

from packages.config.py.settings import SETTINGS

settings = SETTINGS
settings.APP_NAME = "My Service"  # Service-specific overrides
```

## Environment Variables

### Old Way
- Each service had its own `.env` file
- No profile system
- Manual coordination between services

### New Way
- Centralized `.env` files in `/env`
- Profile-based (dev/test/ci/staging/prod)
- Layered loading with local overrides

**Loading Order:**
1. `env/.env` (global fallbacks)
2. `env/.env.<PROFILE>` (e.g., `.env.dev`)
3. `service/.env.local` (gitignored)
4. `service/.env.<PROFILE>.local` (gitignored)

## Migration Steps

### 1. Update Service Imports

**Search Service** (`services/search/app/config.py`):
- Already updated ✅
- Imports from `packages.config.py.settings`

**BrightData Service** (`services/brightdata/app/config.py`):
- Already updated ✅
- Imports from `packages.config.py.settings`

### 2. Update Environment Files

**Create local overrides** (if needed):
```bash
# For service-specific overrides
cd services/search
echo "DB_PATH=/custom/path" > .env.local
```

**Use centralized profiles**:
```bash
# Copy example and customize
cp env/.env.example env/.env.dev
# Edit env/.env.dev with your settings
```

### 3. Update Scripts

**start_all_dime.sh**:
- Already updated ✅
- References new paths: `services/search`, `services/brightdata`, `services/viewer`

**CI/CD**:
- Update any CI scripts that reference old paths
- Set `PROFILE=ci` in CI environment

### 4. Update Python Paths

If your code resolves paths relative to the service directory, update them:

**Before:**
```python
repo_root = Path(__file__).resolve().parents[2]  # app/config.py -> repo
```

**After:**
```python
repo_root = Path(__file__).resolve().parents[3]  # services/search/app/config.py -> repo
```

## Testing the Migration

1. **Check environment loading**:
   ```bash
   cd services/search
   PROFILE=dev python -c "from app.config import settings; print(settings.PORT)"
   ```

2. **Verify config package**:
   ```bash
   python -c "from packages.config.py.settings import SETTINGS; print(SETTINGS.PROFILE)"
   ```

3. **Run services**:
   ```bash
   ./start_all_dime.sh
   ```

## Troubleshooting

### Import Errors

If you see `ModuleNotFoundError: No module named 'packages'`:

1. Ensure you're running from the repo root or the service directory
2. Check that `packages/config/py/__init__.py` exists
3. Verify Python path includes repo root

### Environment Variables Not Loading

1. Check `PROFILE` is set: `echo $PROFILE`
2. Verify `env/.env.<PROFILE>` exists
3. Check file permissions
4. Use `npm run env:print` to see resolved config

### Port Conflicts

Update ports in `env/.env.dev` if you have conflicts:
```bash
SEARCH_API_PORT=7001
BRIGHTDATA_API_URL=http://localhost:7100
VIEWER_PORT=7002
```

## Next Steps

1. ✅ Services moved to `services/`
2. ✅ Config centralized in `packages/config/`
3. ✅ Env files in `env/`
4. ⏳ Update CI/CD pipelines
5. ⏳ Update documentation references
6. ⏳ Team onboarding (share this guide)

## Questions?

- Check `README.md` for usage examples
- Run `npm run env:print` to debug config
- Review `packages/config/README.md` for config details

