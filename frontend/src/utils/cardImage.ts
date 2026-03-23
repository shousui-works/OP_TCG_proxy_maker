/**
 * カードIDから画像URLを取得するユーティリティ
 */

// 開発環境ではViteプロキシ経由、本番環境ではバックエンドAPI経由
const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000'
const isDev = import.meta.env.DEV
const CARD_IMAGE_BASE = isDev
  ? '/card-images/'
  : `${API_BASE}/api/cards/`

/**
 * パラレル版のサフィックスを除去してベースIDを取得
 * 例: OP13-002_p1 -> OP13-002
 */
function getBaseCardId(cardId: string): string {
  return cardId.replace(/_p\d+$/, '')
}

/**
 * カードIDから画像URLを生成
 * 例: OP01-001 -> /card-images/OP01-001.png (開発環境)
 * 例: OP01-001 -> {API_BASE}/api/cards/OP01-001/image (本番環境)
 * パラレル版（_p1, _p2など）はベースカードの画像を使用
 */
export function getCardImageUrl(cardId: string): string {
  if (!cardId) return ''
  const baseId = getBaseCardId(cardId)
  if (isDev) {
    return `${CARD_IMAGE_BASE}${baseId}.png`
  }
  return `${CARD_IMAGE_BASE}${baseId}/image`
}

/**
 * 画像URLを取得（カードIDから生成）
 * 保存されたURLは無視してカードIDから生成（パラレル版・CORS対応）
 */
export function resolveCardImage(_image: string | undefined, cardId: string): string {
  return getCardImageUrl(cardId)
}
