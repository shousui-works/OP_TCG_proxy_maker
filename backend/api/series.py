"""
Series and card data API endpoints
"""

import json

from fastapi import APIRouter

from backend.config import settings
from backend.services.gcs_service import GCSService

router = APIRouter(tags=["series"])


@router.get("/series")
def get_series():
    """Get list of all series"""
    # Try GCS first
    if GCSService.is_available() and settings.DATA_FILES_BUCKET:
        data = GCSService.load_json(settings.DATA_FILES_BUCKET, "series_data.json")
        if data:
            return data

    # Fall back to local file
    if not settings.SERIES_DATA_FILE.exists():
        return {"series": [], "last_updated": None}

    with open(settings.SERIES_DATA_FILE, "r", encoding="utf-8") as f:
        return json.load(f)


@router.get("/cards/data")
def get_cards_data():
    """Get saved card data"""
    # Try GCS first
    if GCSService.is_available() and settings.DATA_FILES_BUCKET:
        data = GCSService.load_json(settings.DATA_FILES_BUCKET, "all_cards.json")
        if data:
            return data

    # Fall back to local file
    if not settings.CARDS_DATA_FILE.exists():
        return {"cards": {}, "total_cards": 0, "crawled_at": None}

    with open(settings.CARDS_DATA_FILE, "r", encoding="utf-8") as f:
        return json.load(f)
