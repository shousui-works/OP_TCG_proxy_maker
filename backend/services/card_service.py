"""
Card service for listing and serving card images
"""

import io
from pathlib import Path

from PIL import Image

from backend.config import settings
from backend.services.gcs_service import GCSService


class CardService:
    """Service for card-related operations"""

    @staticmethod
    def list_cards() -> dict:
        """
        Get list of all available cards.

        Returns:
            Dict with 'cards' list
        """
        if GCSService.is_available() and settings.CARD_IMAGES_BUCKET:
            return CardService._list_cards_from_gcs()
        return CardService._list_cards_from_local()

    @staticmethod
    def _list_cards_from_gcs() -> dict:
        """Get card list from GCS"""
        cards = []
        blobs = GCSService.list_blobs(settings.CARD_IMAGES_BUCKET)

        for blob in blobs:
            if not blob.name.endswith(".png"):
                continue

            parts = blob.name.rsplit("/", 1)
            if len(parts) == 2:
                series_id, filename = parts
                card_id = filename.replace(".png", "")
                cards.append(
                    {
                        "id": card_id,
                        "name": card_id,
                        "series_id": series_id,
                        "image": f"/api/cards/{series_id}/{card_id}/image",
                    }
                )
            else:
                card_id = blob.name.replace(".png", "")
                cards.append(
                    {
                        "id": card_id,
                        "name": card_id,
                        "series_id": None,
                        "image": f"/api/cards/{card_id}/image",
                    }
                )

        return {"cards": sorted(cards, key=lambda x: (x["series_id"] or "", x["id"]))}

    @staticmethod
    def _list_cards_from_local() -> dict:
        """Get card list from local filesystem"""
        if not settings.CARDS_DIR.exists():
            return {"cards": []}

        cards = []

        # Scan series directories
        for series_dir in sorted(settings.CARDS_DIR.iterdir()):
            if series_dir.is_dir():
                series_id = series_dir.name
                for img_path in sorted(series_dir.glob("*.png")):
                    card_id = img_path.stem
                    cards.append(
                        {
                            "id": card_id,
                            "name": card_id,
                            "series_id": series_id,
                            "image": f"/api/cards/{series_id}/{card_id}/image",
                        }
                    )

        # Also handle legacy format (files directly in cards/)
        for img_path in sorted(settings.CARDS_DIR.glob("*.png")):
            card_id = img_path.stem
            cards.append(
                {
                    "id": card_id,
                    "name": card_id,
                    "series_id": None,
                    "image": f"/api/cards/{card_id}/image",
                }
            )

        return {"cards": cards}

    @staticmethod
    def get_card_path(series_id: str | None, card_id: str) -> Path:
        """
        Get local path to card image.

        Args:
            series_id: Series identifier (optional)
            card_id: Card identifier

        Returns:
            Path to card image file
        """
        if series_id:
            return settings.CARDS_DIR / series_id / f"{card_id}.png"
        return settings.CARDS_DIR / f"{card_id}.png"

    @staticmethod
    def validate_card_path(img_path: Path) -> bool:
        """
        Validate that path is within CARDS_DIR (prevent path traversal).

        Args:
            img_path: Path to validate

        Returns:
            True if path is safe, False otherwise
        """
        try:
            img_path.resolve().relative_to(settings.CARDS_DIR.resolve())
            return True
        except ValueError:
            return False

    @staticmethod
    def generate_thumbnail(img_path: Path, size: int) -> bytes:
        """
        Generate thumbnail from image.

        Args:
            img_path: Path to source image
            size: Target width in pixels

        Returns:
            WebP image bytes
        """
        with Image.open(img_path) as img:
            width, height = img.size
            ratio = size / width
            new_height = int(height * ratio)

            img_resized = img.resize((size, new_height), Image.Resampling.LANCZOS)

            buffer = io.BytesIO()
            img_resized.save(buffer, format="WEBP", quality=80)
            return buffer.getvalue()

    @staticmethod
    def get_or_create_thumbnail(
        img_path: Path, series_id: str | None, card_id: str, size_name: str
    ) -> bytes:
        """
        Get cached thumbnail or create one.

        Args:
            img_path: Path to source image
            series_id: Series identifier (optional)
            card_id: Card identifier
            size_name: Size name (xs, sm, md)

        Returns:
            WebP image bytes
        """
        size = settings.THUMBNAIL_SIZES.get(size_name, settings.THUMBNAIL_SIZES["sm"])

        # Build cache path
        if series_id:
            cache_path = (
                settings.THUMB_CACHE_DIR / size_name / series_id / f"{card_id}.webp"
            )
        else:
            cache_path = settings.THUMB_CACHE_DIR / size_name / f"{card_id}.webp"

        # Return cached if exists
        if cache_path.exists():
            with open(cache_path, "rb") as f:
                return f.read()

        # Generate thumbnail
        content = CardService.generate_thumbnail(img_path, size)

        # Save to cache
        cache_path.parent.mkdir(parents=True, exist_ok=True)
        with open(cache_path, "wb") as f:
            f.write(content)

        return content
