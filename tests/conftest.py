"""
Pytest configuration and shared fixtures
"""

import pytest
from fastapi.testclient import TestClient

from backend.app import app


@pytest.fixture
def client():
    """Create test client for API tests"""
    return TestClient(app)
