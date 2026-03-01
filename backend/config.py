"""
Configuration settings for OP TCG Deck Builder API
"""

import os
import re
from pathlib import Path


def _load_env_file():
    """Load environment variables from .env file"""
    env_path = Path(__file__).parent.parent / ".env"
    if env_path.exists():
        with open(env_path) as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    key, value = line.split("=", 1)
                    os.environ.setdefault(key.strip(), value.strip())


# Load .env file on module import
_load_env_file()


class Settings:
    """Application settings loaded from environment variables"""

    # GCS settings
    CARD_IMAGES_BUCKET: str | None = os.environ.get("CARD_IMAGES_BUCKET")
    DATA_FILES_BUCKET: str | None = os.environ.get("DATA_FILES_BUCKET")
    GCS_PUBLIC_URL: str | None = os.environ.get("GCS_PUBLIC_URL")
    USE_GCS: bool = bool(CARD_IMAGES_BUCKET)

    # CORS settings
    DEFAULT_ORIGINS: list[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "https://op-tcg-frontend-265857555428.asia-northeast1.run.app",
        "https://op-tcg-frontend-n3xjn7ioga-an.a.run.app",
    ]
    ALLOWED_ORIGINS: list[str] = os.environ.get(
        "ALLOWED_ORIGINS", ",".join(DEFAULT_ORIGINS)
    ).split(",")

    # Validation patterns
    SAFE_NAME_PATTERN: re.Pattern = re.compile(r"^[a-zA-Z0-9_\-]+$")

    # Directory paths
    BASE_DIR: Path = Path(__file__).parent.parent
    CARDS_DIR: Path = BASE_DIR / "cards"
    DATA_DIR: Path = BASE_DIR / "data"
    THUMB_CACHE_DIR: Path = BASE_DIR / "cache" / "thumbnails"
    DECKS_FILE: Path = DATA_DIR / "decks.json"
    CARDS_DATA_FILE: Path = DATA_DIR / "all_cards.json"
    SERIES_DATA_FILE: Path = DATA_DIR / "series_data.json"

    # Thumbnail sizes
    THUMBNAIL_SIZES: dict[str, int] = {
        "xs": 60,   # Deck list
        "sm": 120,  # Mobile card grid
        "md": 180,  # Desktop card grid
    }


# Global settings instance
settings = Settings()
