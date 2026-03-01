"""
CLI entry point for OP TCG Crawler

Usage:
    # Crawl specific series
    uv run python -m crawler --series 569901

    # Crawl all series
    uv run python -m crawler --all

    # List all series
    uv run python -m crawler --list
"""

import argparse

from crawler.optcg_crawler import OPTCGCrawler


def main():
    parser = argparse.ArgumentParser(description="ONE PIECE TCG カードクローラー")
    parser.add_argument("--series", "-s", help="クロールするシリーズID")
    parser.add_argument("--all", "-a", action="store_true", help="全シリーズをクロール")
    parser.add_argument("--list", "-l", action="store_true", help="シリーズ一覧を表示")
    parser.add_argument("--force", "-f", action="store_true", help="既存カードも再取得")
    args = parser.parse_args()

    crawler = OPTCGCrawler()

    try:
        if args.list:
            series_list = crawler.get_series_list()
            print(f"\n全{len(series_list)}シリーズ:")
            for s in series_list:
                print(f"  {s['id']}: {s['name']}")

        elif args.all:
            crawler.crawl_all(force=args.force)

        elif args.series:
            crawler._setup_driver()
            try:
                series_list = crawler.get_series_list()
                series_name = next(
                    (s["name"] for s in series_list if s["id"] == args.series), ""
                )
                crawler.crawl_series(args.series, series_name, force=args.force)
            finally:
                crawler._close_driver()

        else:
            parser.print_help()

    except KeyboardInterrupt:
        print("\n\n中断されました。データを保存中...")
        crawler._save_cards()
        print("保存完了")


if __name__ == "__main__":
    main()
