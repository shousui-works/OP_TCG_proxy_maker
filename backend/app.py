"""
FastAPI application definition
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.api import branches, cards, decks, series
from backend.config import settings

app = FastAPI(title="OP TCG Deck Builder API")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

# Register routers
app.include_router(cards.router, prefix="/api")
app.include_router(branches.router, prefix="/api")
app.include_router(decks.router, prefix="/api")
app.include_router(series.router, prefix="/api")
