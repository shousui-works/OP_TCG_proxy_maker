"""
Tests for branches API endpoints
"""


class TestListBranches:
    """Tests for GET /api/branches"""

    def test_list_branches_returns_200(self, client):
        response = client.get("/api/branches")
        assert response.status_code == 200

    def test_list_branches_returns_required_keys(self, client):
        response = client.get("/api/branches")
        data = response.json()
        assert "current_branch" in data
        assert "branches" in data
        assert isinstance(data["branches"], list)


class TestGetBranch:
    """Tests for GET /api/branches/{branch_name}"""

    def test_get_main_branch(self, client):
        response = client.get("/api/branches/main")
        assert response.status_code == 200

    def test_get_nonexistent_branch_returns_404(self, client):
        response = client.get("/api/branches/nonexistent_branch_xyz")
        assert response.status_code == 404


class TestCreateBranch:
    """Tests for POST /api/branches"""

    def test_create_branch_invalid_name_returns_422(self, client):
        response = client.post(
            "/api/branches",
            json={"name": "invalid@name"},
        )
        assert response.status_code == 422

    def test_create_branch_empty_name_returns_422(self, client):
        response = client.post(
            "/api/branches",
            json={"name": ""},
        )
        assert response.status_code == 422


class TestDeleteBranch:
    """Tests for DELETE /api/branches/{branch_name}"""

    def test_delete_main_returns_400(self, client):
        response = client.delete("/api/branches/main")
        assert response.status_code == 400
        assert "Cannot delete main" in response.json()["detail"]

    def test_delete_nonexistent_returns_404(self, client):
        response = client.delete("/api/branches/nonexistent_branch_xyz")
        assert response.status_code == 404
