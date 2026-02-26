"""
カード画像配信用のAPIサーバー + デッキブランチ管理 + クローリングAPI
"""

import json
import re
import threading
from datetime import datetime
from pathlib import Path
from typing import Optional

from fastapi import BackgroundTasks, FastAPI, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, field_validator

from crawler import OPTCGCrawler

# ブランチ名・カードIDの検証パターン
SAFE_NAME_PATTERN = re.compile(r"^[a-zA-Z0-9_\-]+$")

app = FastAPI(title="OP TCG Deck Builder API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

BASE_DIR = Path(__file__).parent
CARDS_DIR = BASE_DIR / "cards"
DATA_DIR = BASE_DIR / "data"
DECKS_FILE = DATA_DIR / "decks.json"
CARDS_DATA_FILE = DATA_DIR / "all_cards.json"
SERIES_DATA_FILE = DATA_DIR / "series_data.json"


class DeckCard(BaseModel):
    id: str
    name: str
    image: str
    count: int


class LeaderCard(BaseModel):
    id: str
    name: str
    image: str
    color: Optional[str] = None


class Branch(BaseModel):
    name: str
    deck: list[DeckCard]
    leader: Optional[LeaderCard] = None
    parent: Optional[str] = None
    created_at: str
    updated_at: str


def validate_safe_name(name: str, field_name: str = "name") -> str:
    """名前を検証（パストラバーサル・インジェクション防止）"""
    if not name or not SAFE_NAME_PATTERN.match(name):
        raise ValueError(
            f"Invalid {field_name}: only alphanumeric, underscore, and hyphen allowed"
        )
    if len(name) > 100:
        raise ValueError(f"{field_name} is too long (max 100 characters)")
    return name


class CreateBranchRequest(BaseModel):
    name: str
    from_branch: Optional[str] = None

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: str) -> str:
        return validate_safe_name(v, "branch name")

    @field_validator("from_branch")
    @classmethod
    def validate_from_branch(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            return validate_safe_name(v, "from_branch")
        return v


class SaveDeckRequest(BaseModel):
    branch: str
    deck: list[DeckCard]
    leader: Optional[LeaderCard] = None

    @field_validator("branch")
    @classmethod
    def validate_branch(cls, v: str) -> str:
        return validate_safe_name(v, "branch name")


class MergeRequest(BaseModel):
    source: str
    target: str

    @field_validator("source", "target")
    @classmethod
    def validate_branches(cls, v: str) -> str:
        return validate_safe_name(v, "branch name")


def load_data() -> dict:
    """データを読み込む"""
    DATA_DIR.mkdir(exist_ok=True)
    if not DECKS_FILE.exists():
        initial_data = {
            "current_branch": "main",
            "branches": {
                "main": {
                    "name": "main",
                    "deck": [],
                    "leader": None,
                    "parent": None,
                    "created_at": datetime.now().isoformat(),
                    "updated_at": datetime.now().isoformat(),
                }
            }
        }
        save_data(initial_data)
        return initial_data
    with open(DECKS_FILE, "r") as f:
        return json.load(f)


def save_data(data: dict):
    """データを保存"""
    DATA_DIR.mkdir(exist_ok=True)
    with open(DECKS_FILE, "w") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)


# --- カードAPI ---

@app.get("/api/cards")
def list_cards():
    """利用可能なカード一覧を返す（シリーズ別ディレクトリ対応）"""
    if not CARDS_DIR.exists():
        return {"cards": []}

    cards = []
    # シリーズディレクトリを走査
    for series_dir in sorted(CARDS_DIR.iterdir()):
        if series_dir.is_dir():
            series_id = series_dir.name
            for img_path in sorted(series_dir.glob("*.png")):
                card_id = img_path.stem
                cards.append({
                    "id": card_id,
                    "name": card_id,
                    "series_id": series_id,
                    "image": f"/api/cards/{series_id}/{card_id}/image",
                })

    # 旧形式（直下のファイル）も対応
    for img_path in sorted(CARDS_DIR.glob("*.png")):
        card_id = img_path.stem
        cards.append({
            "id": card_id,
            "name": card_id,
            "series_id": None,
            "image": f"/api/cards/{card_id}/image",
        })

    return {"cards": cards}


def validate_path_component(name: str, component_type: str = "name") -> None:
    """パスコンポーネントを検証（パストラバーサル防止）"""
    if not name or not SAFE_NAME_PATTERN.match(name):
        raise HTTPException(
            status_code=400,
            detail=f"Invalid {component_type}: only alphanumeric, underscore, and hyphen allowed",
        )


@app.get("/api/cards/{series_id}/{card_id}/image")
def get_card_image_by_series(series_id: str, card_id: str):
    """シリーズ別カード画像を返す"""
    validate_path_component(series_id, "series_id")
    validate_path_component(card_id, "card_id")

    img_path = CARDS_DIR / series_id / f"{card_id}.png"

    # 追加のセキュリティチェック: パスがCARDS_DIR内に収まっているか確認
    try:
        img_path.resolve().relative_to(CARDS_DIR.resolve())
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid path")

    if not img_path.exists():
        raise HTTPException(status_code=404, detail="Card not found")
    with open(img_path, "rb") as f:
        content = f.read()
    return Response(
        content=content,
        media_type="image/png",
        headers={
            "Access-Control-Allow-Origin": "*",
            "Cache-Control": "public, max-age=86400",
        },
    )


@app.get("/api/cards/{card_id}/image")
def get_card_image(card_id: str):
    """カード画像を返す（旧形式互換）"""
    validate_path_component(card_id, "card_id")

    img_path = CARDS_DIR / f"{card_id}.png"

    # 追加のセキュリティチェック: パスがCARDS_DIR内に収まっているか確認
    try:
        img_path.resolve().relative_to(CARDS_DIR.resolve())
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid path")

    if not img_path.exists():
        raise HTTPException(status_code=404, detail="Card not found")
    with open(img_path, "rb") as f:
        content = f.read()
    return Response(
        content=content,
        media_type="image/png",
        headers={
            "Access-Control-Allow-Origin": "*",
            "Cache-Control": "public, max-age=86400",
        },
    )


# --- ブランチAPI ---

@app.get("/api/branches")
def list_branches():
    """ブランチ一覧を取得"""
    data = load_data()
    branches = []
    for name, branch in data["branches"].items():
        deck_count = sum(card["count"] for card in branch["deck"])
        branches.append({
            "name": name,
            "parent": branch.get("parent"),
            "deck_count": deck_count,
            "created_at": branch["created_at"],
            "updated_at": branch["updated_at"],
        })
    return {
        "current_branch": data["current_branch"],
        "branches": branches,
    }


@app.get("/api/branches/{branch_name}")
def get_branch(branch_name: str):
    """特定のブランチを取得"""
    data = load_data()
    if branch_name not in data["branches"]:
        raise HTTPException(status_code=404, detail="Branch not found")
    return data["branches"][branch_name]


@app.post("/api/branches")
def create_branch(request: CreateBranchRequest):
    """新しいブランチを作成"""
    data = load_data()

    if request.name in data["branches"]:
        raise HTTPException(status_code=400, detail="Branch already exists")

    parent_name = request.from_branch or data["current_branch"]
    if parent_name not in data["branches"]:
        raise HTTPException(status_code=400, detail="Parent branch not found")

    parent_branch = data["branches"][parent_name]
    parent_deck = parent_branch["deck"]
    parent_leader = parent_branch.get("leader")

    now = datetime.now().isoformat()
    data["branches"][request.name] = {
        "name": request.name,
        "deck": parent_deck.copy(),
        "leader": parent_leader,
        "parent": parent_name,
        "created_at": now,
        "updated_at": now,
    }

    save_data(data)
    return {"message": f"Branch '{request.name}' created from '{parent_name}'"}


@app.post("/api/branches/{branch_name}/checkout")
def checkout_branch(branch_name: str):
    """ブランチを切り替える"""
    data = load_data()

    if branch_name not in data["branches"]:
        raise HTTPException(status_code=404, detail="Branch not found")

    data["current_branch"] = branch_name
    save_data(data)

    return {
        "message": f"Switched to branch '{branch_name}'",
        "branch": data["branches"][branch_name]
    }


@app.delete("/api/branches/{branch_name}")
def delete_branch(branch_name: str):
    """ブランチを削除"""
    data = load_data()

    if branch_name == "main":
        raise HTTPException(status_code=400, detail="Cannot delete main branch")

    if branch_name not in data["branches"]:
        raise HTTPException(status_code=404, detail="Branch not found")

    if data["current_branch"] == branch_name:
        data["current_branch"] = "main"

    del data["branches"][branch_name]
    save_data(data)

    return {"message": f"Branch '{branch_name}' deleted"}


@app.post("/api/branches/merge")
def merge_branches(request: MergeRequest):
    """ブランチをマージ"""
    data = load_data()

    if request.source not in data["branches"]:
        raise HTTPException(status_code=404, detail="Source branch not found")
    if request.target not in data["branches"]:
        raise HTTPException(status_code=404, detail="Target branch not found")

    source_branch = data["branches"][request.source]
    data["branches"][request.target]["deck"] = source_branch["deck"].copy()
    data["branches"][request.target]["leader"] = source_branch.get("leader")
    data["branches"][request.target]["updated_at"] = datetime.now().isoformat()

    save_data(data)

    return {"message": f"Merged '{request.source}' into '{request.target}'"}


# --- デッキAPI ---

@app.post("/api/deck/save")
def save_deck(request: SaveDeckRequest):
    """現在のデッキをブランチに保存"""
    data = load_data()

    if request.branch not in data["branches"]:
        raise HTTPException(status_code=404, detail="Branch not found")

    data["branches"][request.branch]["deck"] = [
        card.model_dump() for card in request.deck
    ]
    data["branches"][request.branch]["leader"] = (
        request.leader.model_dump() if request.leader else None
    )
    data["branches"][request.branch]["updated_at"] = datetime.now().isoformat()

    save_data(data)

    return {"message": f"Deck saved to branch '{request.branch}'"}


@app.get("/api/deck/{branch_name}")
def get_deck(branch_name: str):
    """ブランチのデッキを取得"""
    data = load_data()

    if branch_name not in data["branches"]:
        raise HTTPException(status_code=404, detail="Branch not found")

    branch = data["branches"][branch_name]
    return {
        "deck": branch["deck"],
        "leader": branch.get("leader")
    }


# --- シリーズ・カードデータAPI ---

@app.get("/api/series")
def get_series():
    """シリーズ一覧を取得"""
    if not SERIES_DATA_FILE.exists():
        return {"series": [], "last_updated": None}

    with open(SERIES_DATA_FILE, "r", encoding="utf-8") as f:
        return json.load(f)


@app.get("/api/cards/data")
def get_cards_data():
    """保存済みのカードデータを取得"""
    if not CARDS_DATA_FILE.exists():
        return {"cards": {}, "total_cards": 0, "crawled_at": None}

    with open(CARDS_DATA_FILE, "r", encoding="utf-8") as f:
        return json.load(f)


# --- クローリングAPI ---

# クローリング状態を管理
crawl_state = {
    "is_running": False,
    "status": "idle",  # idle, running, completed, error
    "series_id": "",
    "series_name": "",
    "progress": 0,
    "total": 0,
    "new_cards": 0,
    "skipped": 0,
    "downloaded": 0,
    "message": "",
    "errors": [],
}
crawl_lock = threading.Lock()


class CrawlRequest(BaseModel):
    series_id: str
    force: bool = False


class CrawlAllRequest(BaseModel):
    force: bool = False


def update_crawl_progress(data: dict):
    """クローリング進捗を更新"""
    with crawl_lock:
        crawl_state.update(data)


def run_crawl_series(series_id: str, force: bool = False):
    """シリーズをクロール（バックグラウンド実行）"""
    global crawl_state

    with crawl_lock:
        crawl_state["is_running"] = True
        crawl_state["status"] = "running"
        crawl_state["series_id"] = series_id
        crawl_state["progress"] = 0
        crawl_state["total"] = 0
        crawl_state["new_cards"] = 0
        crawl_state["skipped"] = 0
        crawl_state["downloaded"] = 0
        crawl_state["message"] = "クローラーを起動中..."
        crawl_state["errors"] = []

    try:
        crawler = OPTCGCrawler(progress_callback=update_crawl_progress)

        # シリーズ名を取得
        series_list = crawler.get_series_list()
        series_name = next(
            (s["name"] for s in series_list if s["id"] == series_id), ""
        )

        with crawl_lock:
            crawl_state["series_name"] = series_name
            crawl_state["message"] = f"クロール中: {series_name}"

        crawler._setup_driver()
        try:
            crawler.crawl_series(series_id, series_name, force=force)
        finally:
            crawler._close_driver()

        with crawl_lock:
            crawl_state["status"] = "completed"
            crawl_state["message"] = f"完了: {series_name}"
            crawl_state["is_running"] = False

    except Exception as e:
        with crawl_lock:
            crawl_state["status"] = "error"
            crawl_state["message"] = f"エラー: {str(e)}"
            crawl_state["errors"].append(str(e))
            crawl_state["is_running"] = False


def run_crawl_all(force: bool = False):
    """全シリーズをクロール（バックグラウンド実行）"""
    global crawl_state

    with crawl_lock:
        crawl_state["is_running"] = True
        crawl_state["status"] = "running"
        crawl_state["progress"] = 0
        crawl_state["total"] = 0
        crawl_state["new_cards"] = 0
        crawl_state["skipped"] = 0
        crawl_state["downloaded"] = 0
        crawl_state["message"] = "全シリーズクロールを開始..."
        crawl_state["errors"] = []

    try:
        crawler = OPTCGCrawler(progress_callback=update_crawl_progress)
        crawler.crawl_all(force=force)

        with crawl_lock:
            crawl_state["status"] = "completed"
            crawl_state["message"] = f"完了: {len(crawler.all_cards)}枚"
            crawl_state["is_running"] = False

    except Exception as e:
        with crawl_lock:
            crawl_state["status"] = "error"
            crawl_state["message"] = f"エラー: {str(e)}"
            crawl_state["errors"].append(str(e))
            crawl_state["is_running"] = False


@app.get("/api/crawl/status")
def get_crawl_status():
    """クローリング状態を取得"""
    with crawl_lock:
        return crawl_state.copy()


@app.post("/api/crawl/series")
def start_crawl_series(
    request: CrawlRequest, background_tasks: BackgroundTasks
):
    """特定シリーズのクロールを開始"""
    with crawl_lock:
        if crawl_state["is_running"]:
            raise HTTPException(
                status_code=400, detail="Crawling is already running"
            )

    background_tasks.add_task(
        run_crawl_series, request.series_id, request.force
    )
    return {"message": f"Crawling started for series {request.series_id}"}


@app.post("/api/crawl/all")
def start_crawl_all(
    request: CrawlAllRequest, background_tasks: BackgroundTasks
):
    """全シリーズのクロールを開始"""
    with crawl_lock:
        if crawl_state["is_running"]:
            raise HTTPException(
                status_code=400, detail="Crawling is already running"
            )

    background_tasks.add_task(run_crawl_all, request.force)
    return {"message": "Crawling all series started"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=8000,
        log_level="warning",  # アクセスログを抑制
    )
