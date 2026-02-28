"""
Branch API endpoints
"""

from fastapi import APIRouter, HTTPException

from backend.models.branches import CreateBranchRequest, MergeRequest
from backend.services.deck_service import DeckService

router = APIRouter(prefix="/branches", tags=["branches"])


@router.get("")
def list_branches():
    """Get list of all branches"""
    return DeckService.list_branches()


@router.get("/{branch_name}")
def get_branch(branch_name: str):
    """Get a specific branch"""
    branch = DeckService.get_branch(branch_name)
    if branch is None:
        raise HTTPException(status_code=404, detail="Branch not found")
    return branch


@router.post("")
def create_branch(request: CreateBranchRequest):
    """Create a new branch"""
    try:
        return DeckService.create_branch(request.name, request.from_branch)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{branch_name}/checkout")
def checkout_branch(branch_name: str):
    """Switch to a branch"""
    try:
        return DeckService.checkout_branch(branch_name)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.delete("/{branch_name}")
def delete_branch(branch_name: str):
    """Delete a branch"""
    try:
        return DeckService.delete_branch(branch_name)
    except ValueError as e:
        if "Cannot delete main" in str(e):
            raise HTTPException(status_code=400, detail=str(e))
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/merge")
def merge_branches(request: MergeRequest):
    """Merge source branch into target"""
    try:
        return DeckService.merge_branches(request.source, request.target)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
