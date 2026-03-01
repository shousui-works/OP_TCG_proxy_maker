"""
Deck API endpoints
"""

from fastapi import APIRouter, HTTPException

from backend.models.branches import SaveDeckRequest
from backend.services.deck_service import DeckService

router = APIRouter(prefix="/deck", tags=["deck"])


@router.post("/save")
def save_deck(request: SaveDeckRequest):
    """Save current deck to a branch"""
    try:
        deck = [card.model_dump() for card in request.deck]
        leader = request.leader.model_dump() if request.leader else None
        return DeckService.save_deck(request.branch, deck, leader)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/{branch_name}")
def get_deck(branch_name: str):
    """Get deck from a branch"""
    try:
        return DeckService.get_deck(branch_name)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
