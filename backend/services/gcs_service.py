"""
Google Cloud Storage service
"""

import json
from typing import Any

from backend.config import settings


class GCSService:
    """Service for Google Cloud Storage operations"""

    _client = None
    _initialized = False

    @classmethod
    def _init_client(cls):
        """Initialize GCS client if not already done"""
        if cls._initialized:
            return

        cls._initialized = True
        if settings.USE_GCS:
            try:
                from google.cloud import storage

                cls._client = storage.Client()
            except ImportError:
                print("Warning: google-cloud-storage not installed, GCS disabled")

    @classmethod
    def get_client(cls):
        """Get GCS client instance"""
        cls._init_client()
        return cls._client

    @classmethod
    def is_available(cls) -> bool:
        """Check if GCS is available"""
        cls._init_client()
        return cls._client is not None and settings.USE_GCS

    @classmethod
    def load_json(cls, bucket_name: str, blob_name: str) -> Any | None:
        """
        Load JSON file from GCS.

        Args:
            bucket_name: GCS bucket name
            blob_name: Blob path within bucket

        Returns:
            Parsed JSON data or None if not found/error
        """
        client = cls.get_client()
        if not client:
            return None

        try:
            bucket = client.bucket(bucket_name)
            blob = bucket.blob(blob_name)
            if not blob.exists():
                return None
            content = blob.download_as_text()
            return json.loads(content)
        except Exception as e:
            print(f"Error loading {blob_name} from GCS: {e}")
            return None

    @classmethod
    def list_blobs(cls, bucket_name: str):
        """
        List all blobs in a bucket.

        Args:
            bucket_name: GCS bucket name

        Returns:
            Iterator of blobs or empty list
        """
        client = cls.get_client()
        if not client:
            return []

        try:
            bucket = client.bucket(bucket_name)
            return bucket.list_blobs()
        except Exception as e:
            print(f"Error listing blobs from {bucket_name}: {e}")
            return []
