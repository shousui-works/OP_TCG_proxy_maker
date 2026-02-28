"""
Tests for cards API endpoints
"""


class TestListCards:
    """Tests for GET /api/cards"""

    def test_list_cards_returns_200(self, client):
        response = client.get("/api/cards")
        assert response.status_code == 200

    def test_list_cards_returns_cards_key(self, client):
        response = client.get("/api/cards")
        data = response.json()
        assert "cards" in data
        assert isinstance(data["cards"], list)


class TestCardImageValidation:
    """Tests for card image endpoint validation"""

    def test_invalid_card_id_returns_400(self, client):
        response = client.get("/api/cards/invalid@id/image")
        assert response.status_code == 400

    def test_path_traversal_returns_error(self, client):
        # URL-encoded path traversal - FastAPI may decode this
        response = client.get("/api/cards/..%2Fetc%2Fpasswd/image")
        # Should be 400 (invalid chars) or 404 (not found after decode)
        assert response.status_code in (400, 404)

    def test_invalid_series_id_returns_400(self, client):
        response = client.get("/api/cards/invalid@series/ST01-001/image")
        assert response.status_code == 400


class TestCardThumbnail:
    """Tests for card thumbnail endpoint"""

    def test_invalid_size_returns_422(self, client):
        response = client.get("/api/cards/ST01-001/thumb?size=invalid")
        assert response.status_code == 422

    def test_valid_size_params(self, client):
        # These should not return 422 (validation error)
        for size in ["xs", "sm", "md"]:
            response = client.get(f"/api/cards/ST01-001/thumb?size={size}")
            # Will be 404 if card doesn't exist, but not 422
            assert response.status_code != 422
