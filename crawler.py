"""
ONE PIECE Card Game カードリストクローラー
カード画像とカード情報を取得する

使い方:
    # 特定シリーズをクロール
    uv run python crawler.py --series 569901

    # 全シリーズをクロール
    uv run python crawler.py --all

    # シリーズ一覧を表示
    uv run python crawler.py --list
"""

import argparse
import json
import os
import re
import time
from datetime import datetime
from pathlib import Path
from urllib.parse import urljoin

import requests
from selenium import webdriver
from selenium.common.exceptions import TimeoutException
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait

BASE_DIR = Path(__file__).parent
CARDS_DIR = BASE_DIR / "cards"
DATA_DIR = BASE_DIR / "data"
CARDS_DATA_FILE = DATA_DIR / "all_cards.json"
SERIES_DATA_FILE = DATA_DIR / "series_data.json"


class OPTCGCrawler:
    BASE_URL = "https://www.onepiece-cardgame.com"

    def __init__(self, progress_callback=None):
        self.driver = None
        self.all_cards = {}
        self.progress_callback = progress_callback
        self._load_existing_cards()

    def _report_progress(self, **kwargs):
        """進捗をコールバックに報告"""
        if self.progress_callback:
            self.progress_callback(kwargs)

    def _load_existing_cards(self):
        """既存のカードデータを読み込む"""
        if CARDS_DATA_FILE.exists():
            with open(CARDS_DATA_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                self.all_cards = data.get("cards", {})
            print(f"既存カードデータ: {len(self.all_cards)}枚")

    def _save_cards(self):
        """カードデータを保存"""
        DATA_DIR.mkdir(exist_ok=True)
        result = {
            "cards": self.all_cards,
            "total_cards": len(self.all_cards),
            "crawled_at": datetime.now().isoformat(),
        }
        with open(CARDS_DATA_FILE, "w", encoding="utf-8") as f:
            json.dump(result, f, indent=2, ensure_ascii=False)

    def _setup_driver(self, headless: bool = True):
        """Chromeドライバーをセットアップ"""
        options = Options()
        if headless:
            options.add_argument("--headless")
        options.add_argument("--no-sandbox")
        options.add_argument("--disable-dev-shm-usage")
        options.add_argument("--window-size=1920,1080")
        options.add_argument("--lang=ja")
        self.driver = webdriver.Chrome(options=options)
        self.driver.implicitly_wait(5)

    def _close_driver(self):
        """ドライバーを終了"""
        if self.driver:
            self.driver.quit()
            self.driver = None

    def _handle_cookie_consent(self):
        """Cookieの同意ダイアログを閉じる"""
        try:
            consent_button = WebDriverWait(self.driver, 5).until(
                EC.element_to_be_clickable(
                    (By.CSS_SELECTOR, ".cky-btn-accept, [data-cky-tag='accept-button']")
                )
            )
            consent_button.click()
            time.sleep(0.5)
        except TimeoutException:
            pass

    def _extract_card_info_from_element(
        self, card_element, series_id: str, series_name: str
    ) -> dict:
        """カード要素から詳細情報を抽出（ページ内のHTMLから直接取得）"""
        card_id = card_element.get_attribute("id")

        card_info = {
            "id": card_id,
            "series_id": series_id,
            "series_name": series_name,
        }

        # 画像URL
        try:
            img_element = card_element.find_element(By.CSS_SELECTOR, "img.lazy")
            img_src = img_element.get_attribute("data-src")
            if img_src:
                card_info["image_url"] = urljoin(f"{self.BASE_URL}/cardlist/", img_src)
        except Exception:
            pass

        # カード名（cardNameのinnerHTMLまたはimgのalt属性）
        try:
            name_elem = card_element.find_element(By.CSS_SELECTOR, ".cardName")
            name = name_elem.get_attribute("innerHTML").strip()
            card_info["name"] = name
        except Exception:
            try:
                img = card_element.find_element(By.CSS_SELECTOR, "img.lazy")
                card_info["name"] = img.get_attribute("alt") or ""
            except Exception:
                pass

        # ヘッダー情報（カードID | レアリティ | タイプ）
        try:
            info_spans = card_element.find_elements(
                By.CSS_SELECTOR, ".infoCol span"
            )
            if len(info_spans) >= 2:
                card_info["rarity"] = info_spans[1].get_attribute("innerHTML")
            if len(info_spans) >= 3:
                card_info["card_type"] = info_spans[2].get_attribute("innerHTML")
        except Exception:
            pass

        # コスト/ライフ
        try:
            cost_elem = card_element.find_element(By.CSS_SELECTOR, ".cost")
            cost_html = cost_elem.get_attribute("innerHTML")
            # h3タグを除去してテキストを取得
            cost_value = re.sub(r"<h3>.*?</h3>", "", cost_html).strip()
            if "ライフ" in cost_elem.text:
                card_info["life"] = cost_value
            else:
                card_info["cost"] = cost_value
        except Exception:
            pass

        # 属性
        try:
            attr_elem = card_element.find_element(By.CSS_SELECTOR, ".attribute img")
            card_info["attribute"] = attr_elem.get_attribute("alt") or ""
        except Exception:
            pass

        # パワー
        try:
            power_elem = card_element.find_element(By.CSS_SELECTOR, ".power")
            power_html = power_elem.get_attribute("innerHTML")
            card_info["power"] = re.sub(r"<h3>.*?</h3>", "", power_html).strip()
        except Exception:
            pass

        # カウンター
        try:
            counter_elem = card_element.find_element(By.CSS_SELECTOR, ".counter")
            counter_html = counter_elem.get_attribute("innerHTML")
            card_info["counter"] = re.sub(r"<h3>.*?</h3>", "", counter_html).strip()
        except Exception:
            pass

        # 色
        try:
            color_elem = card_element.find_element(By.CSS_SELECTOR, ".color")
            color_html = color_elem.get_attribute("innerHTML")
            card_info["color"] = re.sub(r"<h3>.*?</h3>", "", color_html).strip()
        except Exception:
            pass

        # ブロックアイコン
        try:
            block_elem = card_element.find_element(By.CSS_SELECTOR, ".block")
            block_html = block_elem.get_attribute("innerHTML")
            card_info["blocker"] = re.sub(
                r"<h3>.*?</h3>", "", block_html, flags=re.DOTALL
            ).strip()
        except Exception:
            pass

        # 特徴
        try:
            feature_elem = card_element.find_element(By.CSS_SELECTOR, ".feature")
            feature_html = feature_elem.get_attribute("innerHTML")
            card_info["feature"] = re.sub(r"<h3>.*?</h3>", "", feature_html).strip()
        except Exception:
            pass

        # テキスト（効果）
        try:
            text_elem = card_element.find_element(By.CSS_SELECTOR, ".text")
            text_html = text_elem.get_attribute("innerHTML")
            # h3タグを除去し、brを改行に
            text_content = re.sub(r"<h3>.*?</h3>", "", text_html)
            text_content = re.sub(r"<br\s*/?>", "\n", text_content)
            text_content = re.sub(r"<[^>]+>", "", text_content)
            card_info["text"] = text_content.strip()
        except Exception:
            pass

        # 入手情報
        try:
            get_info_elem = card_element.find_element(By.CSS_SELECTOR, ".getInfo")
            get_info_html = get_info_elem.get_attribute("innerHTML")
            card_info["get_info"] = re.sub(r"<h3>.*?</h3>", "", get_info_html).strip()
        except Exception:
            pass

        return card_info

    def _download_image(self, url: str, card_id: str, series_dir: Path) -> bool:
        """画像をダウンロード"""
        safe_card_id = "".join(c if c.isalnum() or c in "-_" else "_" for c in card_id)
        ext = os.path.splitext(url.split("?")[0])[1] or ".png"
        filepath = series_dir / f"{safe_card_id}{ext}"

        if filepath.exists():
            return False  # 既存

        try:
            response = requests.get(url, timeout=30)
            response.raise_for_status()
            with open(filepath, "wb") as f:
                f.write(response.content)
            return True
        except requests.RequestException as e:
            print(f"    ダウンロードエラー: {e}")
            return False

    def crawl_series(
        self, series_id: str, series_name: str = "", force: bool = False
    ):
        """指定シリーズをクロール"""
        series_url = f"{self.BASE_URL}/cardlist/?series={series_id}"
        series_dir = CARDS_DIR / series_id
        series_dir.mkdir(parents=True, exist_ok=True)

        print(f"\n=== シリーズ: {series_name or series_id} ===")
        print(f"URL: {series_url}")

        if not self.driver:
            self._setup_driver()

        self.driver.get(series_url)
        time.sleep(2)
        self._handle_cookie_consent()

        card_elements = self.driver.find_elements(By.CSS_SELECTOR, ".modalCol")
        total = len(card_elements)
        print(f"カード数: {total}")

        self._report_progress(
            series_id=series_id,
            series_name=series_name,
            total=total,
            progress=0,
            new_cards=0,
            skipped=0,
            downloaded=0,
        )

        if total == 0:
            print("  カードが見つかりません")
            return

        new_cards = 0
        skipped = 0
        downloaded = 0
        updated = 0

        for i, card_element in enumerate(card_elements):
            card_id = card_element.get_attribute("id")
            if not card_id:
                continue

            # 既存カードで詳細情報がある場合はスキップ
            if card_id in self.all_cards and not force:
                existing = self.all_cards[card_id]
                if existing.get("name") and not existing.get("error"):
                    skipped += 1
                    self._report_progress(
                        progress=i + 1,
                        total=total,
                        new_cards=new_cards,
                        skipped=skipped,
                        downloaded=downloaded,
                    )
                    continue

            print(f"\r  [{i+1}/{total}] 取得中: {card_id}    ", end="")

            # カード情報を抽出
            card_info = self._extract_card_info_from_element(
                card_element, series_id, series_name
            )

            # カード情報を保存
            if card_id in self.all_cards:
                updated += 1
            else:
                new_cards += 1
            self.all_cards[card_id] = card_info

            # 画像ダウンロード
            if card_info.get("image_url"):
                if self._download_image(
                    card_info["image_url"], card_id, series_dir
                ):
                    downloaded += 1

            # 進捗報告
            self._report_progress(
                progress=i + 1,
                total=total,
                new_cards=new_cards,
                skipped=skipped,
                downloaded=downloaded,
            )

            # 10件ごとに途中保存
            if (new_cards + updated) % 10 == 0:
                self._save_cards()

        print(
            f"\n  完了: 新規={new_cards}, 更新={updated}, "
            f"スキップ={skipped}, DL={downloaded}"
        )
        self._save_cards()

    def get_series_list(self) -> list:
        """シリーズ一覧をdata/series_data.jsonから取得"""
        if not SERIES_DATA_FILE.exists():
            print(f"エラー: {SERIES_DATA_FILE} が見つかりません")
            return []

        with open(SERIES_DATA_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
            return data.get("series", [])

    def crawl_all(self, force: bool = False):
        """全シリーズをクロール"""
        series_list = self.get_series_list()
        print(f"全{len(series_list)}シリーズをクロールします")

        self._setup_driver()
        try:
            for i, series in enumerate(series_list):
                print(f"\n[{i+1}/{len(series_list)}]", end="")
                self.crawl_series(series["id"], series["name"], force=force)
        finally:
            self._close_driver()

        print("\n\n=== 完了 ===")
        print(f"総カード数: {len(self.all_cards)}")


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
