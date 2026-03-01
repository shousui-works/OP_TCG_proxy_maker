"""
Tests for deck API endpoints
"""


class TestGetDeck:
    """Tests for GET /api/deck/{branch_name}"""

    def test_get_main_deck(self, client):
        response = client.get("/api/deck/main")
        assert response.status_code == 200

    def test_get_deck_returns_required_keys(self, client):
        response = client.get("/api/deck/main")
        data = response.json()
        assert "deck" in data
        assert "leader" in data
        assert isinstance(data["deck"], list)

    def test_get_nonexistent_deck_returns_404(self, client):
        response = client.get("/api/deck/nonexistent_branch_xyz")
        assert response.status_code == 404


class TestSaveDeck:
    """Tests for POST /api/deck/save"""

    def test_save_deck_invalid_branch_returns_422(self, client):
        response = client.post(
            "/api/deck/save",
            json={
                "branch": "invalid@branch",
                "deck": [],
                "leader": None,
            },
        )
        assert response.status_code == 422

    def test_save_deck_nonexistent_branch_returns_404(self, client):
        response = client.post(
            "/api/deck/save",
            json={
                "branch": "nonexistent_branch_xyz",
                "deck": [],
                "leader": None,
            },
        )
        assert response.status_code == 404
