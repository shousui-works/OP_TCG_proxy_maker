"""
Branch-related Pydantic models
"""

from typing import Optional

from pydantic import BaseModel, field_validator

from backend.models.cards import DeckCard, LeaderCard
from backend.utils.validators import validate_safe_name


class Branch(BaseModel):
    """Deck branch for version control"""

    name: str
    deck: list[DeckCard]
    leader: Optional[LeaderCard] = None
    parent: Optional[str] = None
    created_at: str
    updated_at: str


class CreateBranchRequest(BaseModel):
    """Request to create a new branch"""

    name: str
    from_branch: Optional[str] = None

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: str) -> str:
        return validate_safe_name(v, "branch name")

    @field_validator("from_branch")
    @classmethod
    def validate_from_branch(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            return validate_safe_name(v, "from_branch")
        return v


class SaveDeckRequest(BaseModel):
    """Request to save a deck to a branch"""

    branch: str
    deck: list[DeckCard]
    leader: Optional[LeaderCard] = None

    @field_validator("branch")
    @classmethod
    def validate_branch(cls, v: str) -> str:
        return validate_safe_name(v, "branch name")


class MergeRequest(BaseModel):
    """Request to merge branches"""

    source: str
    target: str

    @field_validator("source", "target")
    @classmethod
    def validate_branches(cls, v: str) -> str:
        return validate_safe_name(v, "branch name")
