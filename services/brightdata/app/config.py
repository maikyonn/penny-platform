"""BrightData service configuration using centralized config package."""

import sys
from pathlib import Path

# Add packages to path for centralized config
_repo_root = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(_repo_root))

from packages.config.py.settings import SETTINGS

# Import centralized settings and extend with service-specific logic
settings = SETTINGS

# Service-specific app name and port override
settings.APP_NAME = "DIME-AI BrightData API"
settings.VERSION = "0.1.0"
settings.PORT = 9101
settings.API_V1_PREFIX = "/brightdata"

# BrightData-specific defaults if not set
if not hasattr(settings, 'BRIGHTDATA_POLL_INTERVAL') or settings.BRIGHTDATA_POLL_INTERVAL is None:
    settings.BRIGHTDATA_POLL_INTERVAL = 30
