"""
Legacy crawler.py - This file is kept for backwards compatibility.
The actual implementation has moved to crawler/ package.

Usage:
    python crawler.py --list       # Still works
    python -m crawler --list       # New recommended way
"""

from crawler.main import main
from crawler.optcg_crawler import OPTCGCrawler

__all__ = ["OPTCGCrawler", "main"]

if __name__ == "__main__":
    main()
