"""
Entry point for the OP TCG Deck Builder API
"""

import uvicorn


def main():
    """Run the API server"""
    uvicorn.run(
        "backend.app:app",
        host="0.0.0.0",
        port=8000,
        log_level="warning",
    )


if __name__ == "__main__":
    main()
