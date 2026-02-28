"""
Deck and branch management service
"""

import json
from datetime import datetime

from backend.config import settings


class DeckService:
    """Service for deck and branch operations"""

    @staticmethod
    def load_data() -> dict:
        """
        Load deck data from file.

        Returns:
            Dict with branches and current_branch
        """
        settings.DATA_DIR.mkdir(exist_ok=True)

        if not settings.DECKS_FILE.exists():
            initial_data = {
                "current_branch": "main",
                "branches": {
                    "main": {
                        "name": "main",
                        "deck": [],
                        "leader": None,
                        "parent": None,
                        "created_at": datetime.now().isoformat(),
                        "updated_at": datetime.now().isoformat(),
                    }
                },
            }
            DeckService.save_data(initial_data)
            return initial_data

        with open(settings.DECKS_FILE, "r", encoding="utf-8") as f:
            return json.load(f)

    @staticmethod
    def save_data(data: dict) -> None:
        """
        Save deck data to file.

        Args:
            data: Data to save
        """
        settings.DATA_DIR.mkdir(exist_ok=True)
        with open(settings.DECKS_FILE, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)

    @staticmethod
    def get_branch(branch_name: str) -> dict | None:
        """
        Get a specific branch.

        Args:
            branch_name: Name of the branch

        Returns:
            Branch data or None if not found
        """
        data = DeckService.load_data()
        return data["branches"].get(branch_name)

    @staticmethod
    def list_branches() -> dict:
        """
        Get list of all branches with summary info.

        Returns:
            Dict with current_branch and branches list
        """
        data = DeckService.load_data()
        branches = []

        for name, branch in data["branches"].items():
            deck_count = sum(card["count"] for card in branch["deck"])
            branches.append(
                {
                    "name": name,
                    "parent": branch.get("parent"),
                    "deck_count": deck_count,
                    "created_at": branch["created_at"],
                    "updated_at": branch["updated_at"],
                }
            )

        return {
            "current_branch": data["current_branch"],
            "branches": branches,
        }

    @staticmethod
    def create_branch(name: str, from_branch: str | None = None) -> dict:
        """
        Create a new branch.

        Args:
            name: Name for new branch
            from_branch: Parent branch name (optional)

        Returns:
            Dict with success message

        Raises:
            ValueError: If branch already exists or parent not found
        """
        data = DeckService.load_data()

        if name in data["branches"]:
            raise ValueError("Branch already exists")

        parent_name = from_branch or data["current_branch"]
        if parent_name not in data["branches"]:
            raise ValueError("Parent branch not found")

        parent_branch = data["branches"][parent_name]
        now = datetime.now().isoformat()

        data["branches"][name] = {
            "name": name,
            "deck": parent_branch["deck"].copy(),
            "leader": parent_branch.get("leader"),
            "parent": parent_name,
            "created_at": now,
            "updated_at": now,
        }

        DeckService.save_data(data)
        return {"message": f"Branch '{name}' created from '{parent_name}'"}

    @staticmethod
    def checkout_branch(branch_name: str) -> dict:
        """
        Switch to a branch.

        Args:
            branch_name: Name of branch to switch to

        Returns:
            Dict with message and branch data

        Raises:
            ValueError: If branch not found
        """
        data = DeckService.load_data()

        if branch_name not in data["branches"]:
            raise ValueError("Branch not found")

        data["current_branch"] = branch_name
        DeckService.save_data(data)

        return {
            "message": f"Switched to branch '{branch_name}'",
            "branch": data["branches"][branch_name],
        }

    @staticmethod
    def delete_branch(branch_name: str) -> dict:
        """
        Delete a branch.

        Args:
            branch_name: Name of branch to delete

        Returns:
            Dict with success message

        Raises:
            ValueError: If trying to delete main or branch not found
        """
        data = DeckService.load_data()

        if branch_name == "main":
            raise ValueError("Cannot delete main branch")

        if branch_name not in data["branches"]:
            raise ValueError("Branch not found")

        if data["current_branch"] == branch_name:
            data["current_branch"] = "main"

        del data["branches"][branch_name]
        DeckService.save_data(data)

        return {"message": f"Branch '{branch_name}' deleted"}

    @staticmethod
    def merge_branches(source: str, target: str) -> dict:
        """
        Merge source branch into target.

        Args:
            source: Source branch name
            target: Target branch name

        Returns:
            Dict with success message

        Raises:
            ValueError: If branches not found
        """
        data = DeckService.load_data()

        if source not in data["branches"]:
            raise ValueError("Source branch not found")
        if target not in data["branches"]:
            raise ValueError("Target branch not found")

        source_branch = data["branches"][source]
        data["branches"][target]["deck"] = source_branch["deck"].copy()
        data["branches"][target]["leader"] = source_branch.get("leader")
        data["branches"][target]["updated_at"] = datetime.now().isoformat()

        DeckService.save_data(data)
        return {"message": f"Merged '{source}' into '{target}'"}

    @staticmethod
    def save_deck(branch: str, deck: list[dict], leader: dict | None) -> dict:
        """
        Save deck to a branch.

        Args:
            branch: Branch name
            deck: List of deck cards
            leader: Leader card (optional)

        Returns:
            Dict with success message

        Raises:
            ValueError: If branch not found
        """
        data = DeckService.load_data()

        if branch not in data["branches"]:
            raise ValueError("Branch not found")

        data["branches"][branch]["deck"] = deck
        data["branches"][branch]["leader"] = leader
        data["branches"][branch]["updated_at"] = datetime.now().isoformat()

        DeckService.save_data(data)
        return {"message": f"Deck saved to branch '{branch}'"}

    @staticmethod
    def get_deck(branch_name: str) -> dict:
        """
        Get deck from a branch.

        Args:
            branch_name: Branch name

        Returns:
            Dict with deck and leader

        Raises:
            ValueError: If branch not found
        """
        data = DeckService.load_data()

        if branch_name not in data["branches"]:
            raise ValueError("Branch not found")

        branch = data["branches"][branch_name]
        return {"deck": branch["deck"], "leader": branch.get("leader")}
