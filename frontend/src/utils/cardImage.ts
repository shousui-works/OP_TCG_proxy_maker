/**
 * カードIDから画像URLを取得するユーティリティ
 */

const isDev = import.meta.env.DEV

// 開発環境: Viteプロキシ経由で公式サイトから取得
// 本番環境: GCSから直接取得（リダイレクトなし）
const GCS_PUBLIC_URL = 'https://storage.googleapis.com/op-tcg-project-card-images'

// サムネイルサイズ: xs=60px, sm=120px, md=180px
export type ThumbnailSize = 'xs' | 'sm' | 'md'

/**
 * パラレル版のサフィックスを除去してベースIDを取得
 * 例: OP13-002_p1 -> OP13-002
 */
function getBaseCardId(cardId: string): string {
  return cardId.replace(/_p\d+$/, '')
}

/**
 * パラレル版かどうかを判定
 */
function isParallelCard(cardId: string): boolean {
  return /_p\d+$/.test(cardId)
}

/**
 * series_idとcard_idから画像URLを生成
 * 本番環境: GCSから直接取得（APIリダイレクトなし、高速）
 * 開発環境: Viteプロキシ経由で公式サイトから取得
 * 注意: パラレル版はseries_idが異なるためAPIフォールバックを使用
 */
export function getCardImageUrlWithSeries(seriesId: string, cardId: string): string {
  if (!cardId) return ''
  const baseId = getBaseCardId(cardId)

  if (isDev) {
    // 開発環境: 公式サイトからプロキシ経由
    return `/card-images/${baseId}.png`
  }

  // パラレル版はseries_idがベースカードと異なるのでAPIフォールバック
  if (isParallelCard(cardId)) {
    const API_BASE = import.meta.env.VITE_API_BASE || ''
    return `${API_BASE}/api/cards/${baseId}/image`
  }

  // 本番環境: GCSから直接取得
  return `${GCS_PUBLIC_URL}/${seriesId}/${baseId}.png`
}

/**
 * カードIDのみから画像URLを生成（series_idがない場合のフォールバック）
 * 開発環境でのみ使用推奨
 */
export function getCardImageUrl(cardId: string): string {
  if (!cardId) return ''
  const baseId = getBaseCardId(cardId)

  if (isDev) {
    return `/card-images/${baseId}.png`
  }

  // 本番でseries_idがない場合はフォールバック（遅い）
  const API_BASE = import.meta.env.VITE_API_BASE || ''
  return `${API_BASE}/api/cards/${baseId}/image`
}

/**
 * 画像URLを取得（カードオブジェクトから）
 */
export function resolveCardImage(_image: string | undefined, cardId: string, seriesId?: string): string {
  if (seriesId) {
    return getCardImageUrlWithSeries(seriesId, cardId)
  }
  return getCardImageUrl(cardId)
}

/**
 * カードIDからサムネイル画像URLを生成
 * 現状はフルサイズ画像と同じURLを返す
 */
export function getCardThumbnailUrl(cardId: string, _size: ThumbnailSize = 'sm', seriesId?: string): string {
  if (seriesId) {
    return getCardImageUrlWithSeries(seriesId, cardId)
  }
  return getCardImageUrl(cardId)
}
