"""
Legacy server.py - This file is kept for backwards compatibility.
The actual implementation has moved to backend/ package.

Usage:
    python server.py          # Still works for backwards compatibility
    uvicorn backend.app:app   # New recommended way
"""

from backend.app import app

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000, log_level="warning")
