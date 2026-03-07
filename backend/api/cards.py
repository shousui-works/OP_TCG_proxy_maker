"""
Card API endpoints
"""

import json

from fastapi import APIRouter, HTTPException, Query, Response
from fastapi.responses import RedirectResponse

from backend.config import settings
from backend.services.card_service import CardService
from backend.services.gcs_service import GCSService
from backend.utils.validators import validate_path_component

router = APIRouter(tags=["cards"])

# Fields needed by frontend for filtering/display
CARD_FIELDS = [
    "name", "rarity", "card_type", "cost", "life",
    "power", "counter", "color", "attribute", "feature",
]


def _get_card_details() -> dict:
    """Get card details from file/GCS"""
    if GCSService.is_available() and settings.DATA_FILES_BUCKET:
        data = GCSService.load_json(settings.DATA_FILES_BUCKET, "all_cards.json")
        if data:
            return data.get("cards", {})

    if settings.CARDS_DATA_FILE.exists():
        with open(settings.CARDS_DATA_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
            return data.get("cards", {})

    return {}


@router.get("/cards")
def list_cards(include_details: bool = False):
    """
    Get list of all available cards.

    Args:
        include_details: If True, include card details (name, rarity, etc.)
                        in each card. Combines /cards and /cards/data.
    """
    result = CardService.list_cards()

    if include_details:
        details = _get_card_details()
        for card in result.get("cards", []):
            card_id = card.get("id")
            if card_id and card_id in details:
                card_detail = details[card_id]
                for field in CARD_FIELDS:
                    if field in card_detail:
                        card[field] = card_detail[field]

    return result


@router.get("/cards/{series_id}/{card_id}/image")
def get_card_image_by_series(series_id: str, card_id: str):
    """Get card image by series and card ID"""
    validate_path_component(series_id, "series_id")
    validate_path_component(card_id, "card_id")

    # Redirect to GCS if available
    if GCSService.is_available() and settings.GCS_PUBLIC_URL:
        gcs_url = f"{settings.GCS_PUBLIC_URL}/{series_id}/{card_id}.png"
        return RedirectResponse(url=gcs_url, status_code=302)

    # Serve from local filesystem
    img_path = CardService.get_card_path(series_id, card_id)

    if not CardService.validate_card_path(img_path):
        raise HTTPException(status_code=400, detail="Invalid path")

    if not img_path.exists():
        raise HTTPException(status_code=404, detail="Card not found")

    with open(img_path, "rb") as f:
        content = f.read()

    return Response(
        content=content,
        media_type="image/png",
        headers={
            "Access-Control-Allow-Origin": "*",
            "Cache-Control": "public, max-age=86400",
        },
    )


@router.get("/cards/{card_id}/image")
def get_card_image(card_id: str):
    """Get card image by ID (legacy format)"""
    validate_path_component(card_id, "card_id")

    # Redirect to GCS if available
    if GCSService.is_available() and settings.GCS_PUBLIC_URL:
        gcs_url = f"{settings.GCS_PUBLIC_URL}/{card_id}.png"
        return RedirectResponse(url=gcs_url, status_code=302)

    # Serve from local filesystem
    img_path = CardService.get_card_path(None, card_id)

    if not CardService.validate_card_path(img_path):
        raise HTTPException(status_code=400, detail="Invalid path")

    if not img_path.exists():
        raise HTTPException(status_code=404, detail="Card not found")

    with open(img_path, "rb") as f:
        content = f.read()

    return Response(
        content=content,
        media_type="image/png",
        headers={
            "Access-Control-Allow-Origin": "*",
            "Cache-Control": "public, max-age=86400",
        },
    )


@router.get("/cards/{series_id}/{card_id}/thumb")
def get_card_thumbnail_by_series(
    series_id: str,
    card_id: str,
    size: str = Query(default="sm", pattern="^(xs|sm|md)$"),
):
    """Get card thumbnail by series and card ID"""
    validate_path_component(series_id, "series_id")
    validate_path_component(card_id, "card_id")

    img_path = CardService.get_card_path(series_id, card_id)

    if not CardService.validate_card_path(img_path):
        raise HTTPException(status_code=400, detail="Invalid path")

    if not img_path.exists():
        raise HTTPException(status_code=404, detail="Card not found")

    content = CardService.get_or_create_thumbnail(img_path, series_id, card_id, size)

    return Response(
        content=content,
        media_type="image/webp",
        headers={
            "Access-Control-Allow-Origin": "*",
            "Cache-Control": "public, max-age=604800",
        },
    )


@router.get("/cards/{card_id}/thumb")
def get_card_thumbnail(
    card_id: str,
    size: str = Query(default="sm", pattern="^(xs|sm|md)$"),
):
    """Get card thumbnail by ID (legacy format)"""
    validate_path_component(card_id, "card_id")

    img_path = CardService.get_card_path(None, card_id)

    if not CardService.validate_card_path(img_path):
        raise HTTPException(status_code=400, detail="Invalid path")

    if not img_path.exists():
        raise HTTPException(status_code=404, detail="Card not found")

    content = CardService.get_or_create_thumbnail(img_path, None, card_id, size)

    return Response(
        content=content,
        media_type="image/webp",
        headers={
            "Access-Control-Allow-Origin": "*",
            "Cache-Control": "public, max-age=604800",
        },
    )
