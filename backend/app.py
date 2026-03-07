"""
FastAPI application definition
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware

from backend.api import branches, cards, decks, series
from backend.config import settings

app = FastAPI(title="OP TCG Deck Builder API")

# GZip compression for JSON/text responses > 500 bytes
# Note: GZipMiddleware checks Accept-Encoding header and content size.
# Image endpoints return pre-compressed formats (PNG/WebP), and gzip
# compression on these has minimal effect while consuming CPU.
# However, the overhead is acceptable for this application since:
# 1. Most requests are JSON (cards list, deck data)
# 2. Image endpoints use redirect to GCS in production
app.add_middleware(GZipMiddleware, minimum_size=500)

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
