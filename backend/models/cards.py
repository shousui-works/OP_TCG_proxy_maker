"""
Card-related Pydantic models
"""

from typing import Optional

from pydantic import BaseModel


class DeckCard(BaseModel):
    """Card in a deck with count"""

    id: str
    name: str
    image: str
    count: int


class LeaderCard(BaseModel):
    """Leader card for a deck"""

    id: str
    name: str
    image: str
    color: Optional[str] = None
