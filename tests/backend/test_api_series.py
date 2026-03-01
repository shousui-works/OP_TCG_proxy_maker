"""
Tests for series API endpoints
"""


class TestGetSeries:
    """Tests for GET /api/series"""

    def test_get_series_returns_200(self, client):
        response = client.get("/api/series")
        assert response.status_code == 200

    def test_get_series_returns_required_keys(self, client):
        response = client.get("/api/series")
        data = response.json()
        assert "series" in data
        assert isinstance(data["series"], list)


class TestGetCardsData:
    """Tests for GET /api/cards/data"""

    def test_get_cards_data_returns_200(self, client):
        response = client.get("/api/cards/data")
        assert response.status_code == 200

    def test_get_cards_data_returns_required_keys(self, client):
        response = client.get("/api/cards/data")
        data = response.json()
        assert "cards" in data
