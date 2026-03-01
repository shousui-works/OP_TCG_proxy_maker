"""
Entry point for Cloud Run deployment
"""

import uvicorn

from backend.app import app


def main():
    """Run the API server"""
    import os

    port = int(os.environ.get("PORT", 8080))
    uvicorn.run(app, host="0.0.0.0", port=port, log_level="info")


if __name__ == "__main__":
    main()
