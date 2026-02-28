"""
ONE PIECE Card Game Crawler

Crawl card images and information from the official website.
"""

import json
import os
import re
import time
from datetime import datetime
from pathlib import Path
from typing import Callable
from urllib.parse import urljoin

import requests
from selenium import webdriver
from selenium.common.exceptions import TimeoutException
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait

BASE_DIR = Path(__file__).parent.parent
CARDS_DIR = BASE_DIR / "cards"
DATA_DIR = BASE_DIR / "data"
CARDS_DATA_FILE = DATA_DIR / "all_cards.json"
SERIES_DATA_FILE = DATA_DIR / "series_data.json"


class OPTCGCrawler:
    """Crawler for ONE PIECE TCG card data and images"""

    BASE_URL = "https://www.onepiece-cardgame.com"

    def __init__(
        self,
        progress_callback: Callable[[dict], None] | None = None,
        gcs_data_bucket: str | None = None,
        gcs_images_bucket: str | None = None,
    ):
        self.driver = None
        self.all_cards: dict = {}
        self.progress_callback = progress_callback
        self.gcs_data_bucket = gcs_data_bucket
        self.gcs_images_bucket = gcs_images_bucket
        self.gcs_client = None

        # Initialize GCS client if buckets are specified
        if self.gcs_data_bucket or self.gcs_images_bucket:
            try:
                from google.cloud import storage

                self.gcs_client = storage.Client()
            except ImportError:
                print("Warning: google-cloud-storage not installed, GCS disabled")

        self._load_existing_cards()

    def _report_progress(self, **kwargs):
        """Report progress to callback"""
        if self.progress_callback:
            self.progress_callback(kwargs)

    def _load_existing_cards(self):
        """Load existing card data (GCS priority)"""
        # Load from GCS
        if self.gcs_client and self.gcs_data_bucket:
            try:
                bucket = self.gcs_client.bucket(self.gcs_data_bucket)
                blob = bucket.blob("all_cards.json")
                if blob.exists():
                    content = blob.download_as_text()
                    data = json.loads(content)
                    self.all_cards = data.get("cards", {})
                    print(f"GCSから既存カードデータ: {len(self.all_cards)}枚")
                    return
            except Exception as e:
                print(f"GCS読み込みエラー: {e}")

        # Load from local
        if CARDS_DATA_FILE.exists():
            with open(CARDS_DATA_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                self.all_cards = data.get("cards", {})
            print(f"既存カードデータ: {len(self.all_cards)}枚")

    def _save_cards(self):
        """Save card data (local + GCS)"""
        result = {
            "cards": self.all_cards,
            "total_cards": len(self.all_cards),
            "crawled_at": datetime.now().isoformat(),
        }

        # Save locally
        DATA_DIR.mkdir(exist_ok=True)
        with open(CARDS_DATA_FILE, "w", encoding="utf-8") as f:
            json.dump(result, f, indent=2, ensure_ascii=False)

        # Upload to GCS
        if self.gcs_client and self.gcs_data_bucket:
            try:
                bucket = self.gcs_client.bucket(self.gcs_data_bucket)
                blob = bucket.blob("all_cards.json")
                blob.upload_from_string(
                    json.dumps(result, indent=2, ensure_ascii=False),
                    content_type="application/json",
                )
                print("  GCSにカードデータをアップロードしました")
            except Exception as e:
                print(f"  GCSアップロードエラー: {e}")

    def _setup_driver(self, headless: bool = True):
        """Setup Chrome driver"""
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
        """Close driver"""
        if self.driver:
            self.driver.quit()
            self.driver = None

    def _handle_cookie_consent(self):
        """Close cookie consent dialog"""
        try:
            consent_button = WebDriverWait(self.driver, 5).until(
                EC.element_to_be_clickable(
                    (
                        By.CSS_SELECTOR,
                        ".cky-btn-accept, [data-cky-tag='accept-button']",
                    )
                )
            )
            consent_button.click()
            time.sleep(0.5)
        except TimeoutException:
            pass

    def _extract_card_info_from_element(
        self, card_element, series_id: str, series_name: str
    ) -> dict:
        """Extract card info from element"""
        card_id = card_element.get_attribute("id")

        card_info = {
            "id": card_id,
            "series_id": series_id,
            "series_name": series_name,
        }

        # Image URL
        try:
            img_element = card_element.find_element(By.CSS_SELECTOR, "img.lazy")
            img_src = img_element.get_attribute("data-src")
            if img_src:
                card_info["image_url"] = urljoin(
                    f"{self.BASE_URL}/cardlist/", img_src
                )
        except Exception:
            pass

        # Card name
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

        # Header info (card ID | rarity | type)
        try:
            info_spans = card_element.find_elements(By.CSS_SELECTOR, ".infoCol span")
            if len(info_spans) >= 2:
                card_info["rarity"] = info_spans[1].get_attribute("innerHTML")
            if len(info_spans) >= 3:
                card_info["card_type"] = info_spans[2].get_attribute("innerHTML")
        except Exception:
            pass

        # Cost/Life
        try:
            cost_elem = card_element.find_element(By.CSS_SELECTOR, ".cost")
            cost_html = cost_elem.get_attribute("innerHTML")
            cost_value = re.sub(r"<h3>.*?</h3>", "", cost_html).strip()
            if "ライフ" in cost_elem.text:
                card_info["life"] = cost_value
            else:
                card_info["cost"] = cost_value
        except Exception:
            pass

        # Attribute
        try:
            attr_elem = card_element.find_element(By.CSS_SELECTOR, ".attribute img")
            card_info["attribute"] = attr_elem.get_attribute("alt") or ""
        except Exception:
            pass

        # Power
        try:
            power_elem = card_element.find_element(By.CSS_SELECTOR, ".power")
            power_html = power_elem.get_attribute("innerHTML")
            card_info["power"] = re.sub(r"<h3>.*?</h3>", "", power_html).strip()
        except Exception:
            pass

        # Counter
        try:
            counter_elem = card_element.find_element(By.CSS_SELECTOR, ".counter")
            counter_html = counter_elem.get_attribute("innerHTML")
            card_info["counter"] = re.sub(r"<h3>.*?</h3>", "", counter_html).strip()
        except Exception:
            pass

        # Color
        try:
            color_elem = card_element.find_element(By.CSS_SELECTOR, ".color")
            color_html = color_elem.get_attribute("innerHTML")
            card_info["color"] = re.sub(r"<h3>.*?</h3>", "", color_html).strip()
        except Exception:
            pass

        # Block icon
        try:
            block_elem = card_element.find_element(By.CSS_SELECTOR, ".block")
            block_html = block_elem.get_attribute("innerHTML")
            card_info["blocker"] = re.sub(
                r"<h3>.*?</h3>", "", block_html, flags=re.DOTALL
            ).strip()
        except Exception:
            pass

        # Feature
        try:
            feature_elem = card_element.find_element(By.CSS_SELECTOR, ".feature")
            feature_html = feature_elem.get_attribute("innerHTML")
            card_info["feature"] = re.sub(r"<h3>.*?</h3>", "", feature_html).strip()
        except Exception:
            pass

        # Text (effect)
        try:
            text_elem = card_element.find_element(By.CSS_SELECTOR, ".text")
            text_html = text_elem.get_attribute("innerHTML")
            text_content = re.sub(r"<h3>.*?</h3>", "", text_html)
            text_content = re.sub(r"<br\s*/?>", "\n", text_content)
            text_content = re.sub(r"<[^>]+>", "", text_content)
            card_info["text"] = text_content.strip()
        except Exception:
            pass

        # Get info
        try:
            get_info_elem = card_element.find_element(By.CSS_SELECTOR, ".getInfo")
            get_info_html = get_info_elem.get_attribute("innerHTML")
            card_info["get_info"] = re.sub(
                r"<h3>.*?</h3>", "", get_info_html
            ).strip()
        except Exception:
            pass

        return card_info

    def _download_image(
        self, url: str, card_id: str, series_dir: Path, series_id: str
    ) -> bool:
        """Download image (local + GCS)"""
        safe_card_id = "".join(
            c if c.isalnum() or c in "-_" else "_" for c in card_id
        )
        ext = os.path.splitext(url.split("?")[0])[1] or ".png"
        filepath = series_dir / f"{safe_card_id}{ext}"
        gcs_path = f"{series_id}/{safe_card_id}{ext}"

        # Check if exists in GCS
        if self.gcs_client and self.gcs_images_bucket:
            try:
                bucket = self.gcs_client.bucket(self.gcs_images_bucket)
                blob = bucket.blob(gcs_path)
                if blob.exists():
                    return False
            except Exception:
                pass

        # Check local
        if filepath.exists():
            if self.gcs_client and self.gcs_images_bucket:
                try:
                    bucket = self.gcs_client.bucket(self.gcs_images_bucket)
                    blob = bucket.blob(gcs_path)
                    blob.upload_from_filename(str(filepath), content_type="image/png")
                except Exception:
                    pass
            return False

        try:
            response = requests.get(url, timeout=30)
            response.raise_for_status()
            image_data = response.content

            # Save locally
            with open(filepath, "wb") as f:
                f.write(image_data)

            # Upload to GCS
            if self.gcs_client and self.gcs_images_bucket:
                try:
                    bucket = self.gcs_client.bucket(self.gcs_images_bucket)
                    blob = bucket.blob(gcs_path)
                    blob.upload_from_string(image_data, content_type="image/png")
                except Exception as e:
                    print(f"    GCS画像アップロードエラー: {e}")

            return True
        except requests.RequestException as e:
            print(f"    ダウンロードエラー: {e}")
            return False

    def crawl_series(
        self, series_id: str, series_name: str = "", force: bool = False
    ):
        """Crawl specified series"""
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

            card_info = self._extract_card_info_from_element(
                card_element, series_id, series_name
            )

            if card_id in self.all_cards:
                updated += 1
            else:
                new_cards += 1
            self.all_cards[card_id] = card_info

            if card_info.get("image_url"):
                if self._download_image(
                    card_info["image_url"], card_id, series_dir, series_id
                ):
                    downloaded += 1

            self._report_progress(
                progress=i + 1,
                total=total,
                new_cards=new_cards,
                skipped=skipped,
                downloaded=downloaded,
            )

            if (new_cards + updated) % 10 == 0:
                self._save_cards()

        print(
            f"\n  完了: 新規={new_cards}, 更新={updated}, "
            f"スキップ={skipped}, DL={downloaded}"
        )
        self._save_cards()

    def get_series_list(self) -> list:
        """Get series list from data/series_data.json"""
        if not SERIES_DATA_FILE.exists():
            print(f"エラー: {SERIES_DATA_FILE} が見つかりません")
            return []

        with open(SERIES_DATA_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
            return data.get("series", [])

    def crawl_all(self, force: bool = False):
        """Crawl all series"""
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
